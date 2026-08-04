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

class SalesOrderExport implements FromQuery, WithHeadings, WithMapping, ShouldAutoSize, WithStyles, WithColumnFormatting, WithEvents
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
        $itemsSummary = $order->items->map(function($item) {
            if ($item->productVariant && $item->productVariant->product) {
                $attr = implode(' / ', array_values((array)$item->productVariant->attributes)) ?: 'Default';
                return "{$item->productVariant->product->name} - {$attr} (x{$item->quantity})";
            }
            return "Unknown Item (x{$item->quantity})";
        })->join(', ');

        $latestPayment = $order->payments->sortByDesc('created_at')->first();
        $paymentMethod = $latestPayment ? $latestPayment->payment_method : '-';

        return [
            $order->id,
            $order->created_at->format('Y-m-d H:i:s'),
            $order->customer_name,
            $order->customer_phone,
            $order->delivery_address,
            $order->courier ? $order->courier->name : '-',
            $itemsSummary,
            $order->items->sum('quantity'),
            $order->subtotal,
            $order->discount_total,
            $order->delivery_fee,
            $order->extra_fee,
            $order->overcharge,
            $order->courier_service_fee,
            $order->customer_grand_total,
            $order->net_revenue, // Net Revenue (Actual amount we get)
            $order->paid_amount,
            $order->courier_id 
                ? ($order->net_revenue - $order->paid_amount) 
                : ($order->customer_grand_total - $order->paid_amount), // Remaining Amount
            strtoupper(str_replace('_', ' ', $order->status)),
            strtoupper(str_replace('_', ' ', $order->payment_status)),
            strtoupper($paymentMethod),
        ];
    }

    public function headings(): array
    {
        return [
            'Order ID',
            'Date',
            'Customer Name',
            'Customer Phone',
            'Address',
            'Courier',
            'Items Summary',
            'Total Items',
            'Subtotal (MMK)',
            'Discount (MMK)',
            'Delivery Fee (MMK)',
            'Extra Fee (MMK)',
            'Overcharge (MMK)',
            'Courier Service Fee (MMK)',
            'Grand Total (MMK)',
            'Net Revenue (MMK)',
            'Paid Amount (MMK)',
            'Remaining Amount (MMK)',
            'Order Status',
            'Payment Status',
            'Payment Method',
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
            'H' => '#,##0',
            'I' => '#,##0',
            'J' => '#,##0',
            'K' => '#,##0',
            'L' => '#,##0',
            'M' => '#,##0',
            'N' => '#,##0',
            'O' => '#,##0',
            'P' => '#,##0',
            'Q' => '#,##0',
            'R' => '#,##0',
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                
                // Get just the IDs and statuses to color rows without loading full models
                $orders = clone $this->query;
                $statuses = $orders->pluck('status', 'id')->values();
                
                $rowIndex = 2;
                foreach ($statuses as $status) {
                    $status = strtolower($status);
                    $color = null;
                    
                    if ($status === 'completed' || $status === 'delivered') {
                        $color = 'FFF0FDF4'; // bg-green-50
                    } elseif ($status === 'cancelled') {
                        $color = 'FFFEF2F2'; // bg-red-50
                    } elseif ($status === 'delivery_added') {
                        $color = 'FFEFF6FF'; // bg-blue-50
                    } elseif ($status === 'pending') {
                        $color = 'FFFFFBEB'; // bg-amber-50
                    }

                    if ($color) {
                        $sheet->getStyle('A' . $rowIndex . ':U' . $rowIndex)->applyFromArray([
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
                    SUM(subtotal) as sum_subtotal,
                    SUM(discount_total) as sum_discount,
                    SUM(delivery_fee) as sum_delivery,
                    SUM(extra_fee) as sum_extra,
                    SUM(overcharge) as sum_overcharge,
                    SUM(courier_service_fee) as sum_courier,
                    SUM(customer_grand_total) as sum_grand,
                    SUM(net_revenue) as sum_net,
                    SUM(paid_amount) as sum_paid
                ')->first();
                
                $totalItems = clone $this->query;
                $totalItems = $totalItems->join('sales_order_items', 'sales_orders.id', '=', 'sales_order_items.sales_order_id')
                                         ->sum('sales_order_items.quantity');

                $sheet->setCellValue('A' . $rowIndex, 'Total');
                $sheet->setCellValue('H' . $rowIndex, $totalItems);
                $sheet->setCellValue('I' . $rowIndex, $totals->sum_subtotal ?? 0);
                $sheet->setCellValue('J' . $rowIndex, $totals->sum_discount ?? 0);
                $sheet->setCellValue('K' . $rowIndex, $totals->sum_delivery ?? 0);
                $sheet->setCellValue('L' . $rowIndex, $totals->sum_extra ?? 0);
                $sheet->setCellValue('M' . $rowIndex, $totals->sum_overcharge ?? 0);
                $sheet->setCellValue('N' . $rowIndex, $totals->sum_courier ?? 0);
                $sheet->setCellValue('O' . $rowIndex, $totals->sum_grand ?? 0);
                $sheet->setCellValue('P' . $rowIndex, $totals->sum_net ?? 0);
                $sheet->setCellValue('Q' . $rowIndex, $totals->sum_paid ?? 0);
                $sheet->setCellValue('R' . $rowIndex, ($totals->sum_net ?? 0) - ($totals->sum_paid ?? 0));

                $sheet->getStyle('A' . $rowIndex . ':U' . $rowIndex)->applyFromArray([
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
