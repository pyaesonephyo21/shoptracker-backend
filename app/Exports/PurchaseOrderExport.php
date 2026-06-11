<?php

namespace App\Exports;

use App\Models\PurchaseOrder;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;

class PurchaseOrderExport implements FromCollection, WithHeadings, ShouldAutoSize, WithStyles, WithColumnFormatting
{
    protected $orders;

    public function __construct(Collection $orders)
    {
        $this->orders = $orders;
    }

    public function collection()
    {
        $data = $this->orders->map(function ($order) {
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
                $order->total_goods_cost_foreign,
                $order->supplier_fee_foreign,
                $order->cargo_fee_foreign,
                $order->local_deli_fee,
                $order->adjustment,
                $order->grand_total,
                strtoupper(str_replace('_', ' ', $order->status)),
                strtoupper(str_replace('_', ' ', $order->payment_status)),
                $order->paid_amount,
            ];
        });

        $data->push([
            'Total',
            '',
            '',
            '',
            $this->orders->sum(fn($o) => $o->items->sum('quantity')),
            '',
            $this->orders->sum('total_goods_cost_foreign'),
            $this->orders->sum('supplier_fee_foreign'),
            $this->orders->sum('cargo_fee_foreign'),
            $this->orders->sum('local_deli_fee'),
            $this->orders->sum('adjustment'),
            $this->orders->sum('grand_total'),
            '',
            '',
            $this->orders->sum('paid_amount'),
        ]);

        return $data;
    }

    public function headings(): array
    {
        return [
            'Batch Name / PO Ref',
            'Date',
            'Supplier / Source',
            'Items Summary',
            'Total Items',
            'Exchange Rate',
            'Total Goods Cost (Foreign)',
            'Supplier Fee (Foreign)',
            'Cargo Fee (Foreign)',
            'Local Deli Fee (MMK)',
            'Adjustment (MMK)',
            'Grand Total (MMK)',
            'PO Status',
            'Payment Status',
            'Paid Amount',
        ];
    }

    public function styles(Worksheet $sheet)
    {
        // Set default row height for all data rows to give breathing room
        $sheet->getDefaultRowDimension()->setRowHeight(25);
        
        // Set header height
        $sheet->getRowDimension(1)->setRowHeight(30);

        // Vertically center all data
        $sheet->getStyle($sheet->calculateWorksheetDimension())->getAlignment()->setVertical(\PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_CENTER);

        // Header style (light gray)
        $styles = [
            1    => [
                'font' => [
                    'bold' => true,
                    'color' => ['argb' => 'FF374151'], // text-gray-700
                ],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['argb' => 'FFF3F4F6'], // bg-gray-100
                ],
            ],
        ];

        // Row styles based on status
        $rowIndex = 2;
        foreach ($this->orders as $order) {
            $status = strtolower($order->status);
            $color = null;
            
            if ($status === 'arrived') {
                $color = 'FFF0FDF4'; // bg-green-50
            } elseif ($status === 'cancelled') {
                $color = 'FFFEF2F2'; // bg-red-50
            } elseif ($status === 'pending') {
                $color = 'FFFFFBEB'; // bg-amber-50
            }

            if ($color) {
                $styles[$rowIndex] = [
                    'fill' => [
                        'fillType' => Fill::FILL_SOLID,
                        'startColor' => ['argb' => $color],
                    ],
                ];
            }
            $rowIndex++;
        }

        // Style the total row at the very bottom
        $styles[$rowIndex] = [
            'font' => ['bold' => true, 'color' => ['argb' => 'FF374151']],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['argb' => 'FFF3F4F6'],
            ],
        ];

        return $styles;
    }

    public function columnFormats(): array
    {
        return [
            'E' => '#,##0', // Total Items
            'F' => '#,##0.00', // Exchange Rate
            'G' => '#,##0.00', // Total Goods Cost (Foreign)
            'H' => '#,##0.00', // Supplier Fee (Foreign)
            'I' => '#,##0.00', // Cargo Fee (Foreign)
            'J' => '#,##0', // Local Deli Fee (MMK)
            'K' => '#,##0', // Adjustment (MMK)
            'L' => '#,##0', // Grand Total (MMK)
            'O' => '#,##0', // Paid Amount
        ];
    }
}
