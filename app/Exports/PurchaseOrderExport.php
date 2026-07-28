<?php

namespace App\Exports;

use Illuminate\Database\Eloquent\Builder;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class PurchaseOrderExport implements FromQuery, WithHeadings, WithMapping, ShouldAutoSize, WithStyles, WithColumnFormatting, WithEvents
{
    protected $query;

    public function __construct(Builder $query)
    {
        $this->query = $query;
    }

    public function query()
    {
        return $this->query;
    }

    public function map($order): array
    {
        $supplierName = $order->supplier ? $order->supplier->name : ($order->local_shop_name ?? 'Unknown');
        
        $itemsSummary = $order->items->map(function($item) {
            if ($item->productVariant && $item->productVariant->product) {
                $attr = implode(' / ', array_values((array)$item->productVariant->attributes)) ?: 'Default';
                return "{$item->productVariant->product->name} - {$attr} (x{$item->quantity})";
            }
            return "Unknown Item (x{$item->quantity})";
        })->join(', ');

        return [
            $order->batch_name,
            $order->created_at->format('Y-m-d H:i:s'),
            $supplierName,
            $itemsSummary,
            $order->items->sum('quantity'),
            $order->exchange_rate,
            $order->total_goods_cost,
            $order->foreign_deli_fee,
            $order->total_discount,
            $order->supplier_fee,
            $order->cargo_fee,
            $order->local_deli_fee,
            $order->adjustment_amount,
            $order->grand_total,
            strtoupper(str_replace('_', ' ', $order->status)),
            strtoupper(str_replace('_', ' ', $order->payment_status)),
            $order->paid_amount,
        ];
    }

    public function headings(): array
    {
        return [
            'Batch Name',
            'Date',
            'Supplier',
            'Items Summary',
            'Total Items',
            'Exchange Rate',
            'Total Goods Cost (Foreign)',
            'Foreign Deli Fee (Foreign)',
            'Total Discount',
            'Supplier Fee (Foreign)',
            'Cargo Fee (Foreign)',
            'Local Deli Fee (MMK)',
            'Adjustment (MMK)',
            'Grand Total (MMK)',
            'Status',
            'Payment Status',
            'Paid Amount (MMK)',
        ];
    }

    public function styles(Worksheet $sheet)
    {
        $sheet->getDefaultRowDimension()->setRowHeight(25);
        $sheet->getRowDimension(1)->setRowHeight(30);
        $sheet->getStyle($sheet->calculateWorksheetDimension())->getAlignment()->setVertical(\PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_CENTER);

        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['argb' => 'FF374151']],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['argb' => 'FFF3F4F6'],
                ],
            ],
        ];
    }

    public function columnFormats(): array
    {
        return [
            'G' => '#,##0.00', // Foreign
            'H' => '#,##0.00', // Foreign
            'I' => '#,##0.00', // Discount (Foreign)
            'J' => '#,##0.00', // Foreign
            'K' => '#,##0.00', // Foreign
            'L' => '#,##0',    // MMK
            'M' => '#,##0',    // MMK
            'N' => '#,##0',    // MMK
            'Q' => '#,##0',    // MMK
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                
                // Fetch basic order details for coloring
                $orders = clone $this->query;
                $statuses = $orders->pluck('status', 'id')->values();
                
                $rowIndex = 2;
                foreach ($statuses as $status) {
                    $status = strtolower($status);
                    $color = null;
                    
                    if ($status === 'arrived') {
                        $color = 'FFF0FDF4'; // bg-green-50
                    } elseif ($status === 'cancelled') {
                        $color = 'FFFEF2F2'; // bg-red-50
                    } elseif ($status === 'pending') {
                        $color = 'FFFFFBEB'; // bg-amber-50
                    }

                    if ($color) {
                        $sheet->getStyle('A' . $rowIndex . ':Q' . $rowIndex)->applyFromArray([
                            'fill' => [
                                'fillType' => Fill::FILL_SOLID,
                                'startColor' => ['argb' => $color],
                            ]
                        ]);
                    }
                    $rowIndex++;
                }

                // Add Total Row via SQL Aggregation to avoid memory leak
                $totals = (clone $this->query)->selectRaw('
                    SUM(total_goods_cost) as sum_goods,
                    SUM(foreign_deli_fee) as sum_foreign_deli,
                    SUM(total_discount) as sum_discount,
                    SUM(supplier_fee) as sum_supplier,
                    SUM(cargo_fee) as sum_cargo,
                    SUM(local_deli_fee) as sum_local_deli,
                    SUM(adjustment_amount) as sum_adjustment,
                    SUM(grand_total) as sum_grand,
                    SUM(paid_amount) as sum_paid
                ')->first();
                
                $totalItems = clone $this->query;
                $totalItems = $totalItems->join('purchase_order_items', 'purchase_orders.id', '=', 'purchase_order_items.purchase_order_id')
                                         ->sum('purchase_order_items.quantity');

                $sheet->setCellValue('A' . $rowIndex, 'Total');
                $sheet->setCellValue('E' . $rowIndex, $totalItems);
                $sheet->setCellValue('G' . $rowIndex, $totals->sum_goods ?? 0);
                $sheet->setCellValue('H' . $rowIndex, $totals->sum_foreign_deli ?? 0);
                $sheet->setCellValue('I' . $rowIndex, $totals->sum_discount ?? 0);
                $sheet->setCellValue('J' . $rowIndex, $totals->sum_supplier ?? 0);
                $sheet->setCellValue('K' . $rowIndex, $totals->sum_cargo ?? 0);
                $sheet->setCellValue('L' . $rowIndex, $totals->sum_local_deli ?? 0);
                $sheet->setCellValue('M' . $rowIndex, $totals->sum_adjustment ?? 0);
                $sheet->setCellValue('N' . $rowIndex, $totals->sum_grand ?? 0);
                $sheet->setCellValue('Q' . $rowIndex, $totals->sum_paid ?? 0);

                $sheet->getStyle('A' . $rowIndex . ':Q' . $rowIndex)->applyFromArray([
                    'font' => ['bold' => true, 'color' => ['argb' => 'FF374151']],
                    'fill' => [
                        'fillType' => Fill::FILL_SOLID,
                        'startColor' => ['argb' => 'FFF3F4F6'],
                    ],
                ]);
            }
        ];
    }
}
