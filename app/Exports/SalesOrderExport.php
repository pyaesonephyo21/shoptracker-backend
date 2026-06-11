<?php

namespace App\Exports;

use App\Models\SalesOrder;
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

class SalesOrderExport implements FromCollection, WithHeadings, ShouldAutoSize, WithStyles, WithColumnFormatting
{
    protected $orders;

    public function __construct(Collection $orders)
    {
        $this->orders = $orders;
    }

    public function collection()
    {
        $data = $this->orders->map(function ($order) {
            $itemsSummary = $order->items->map(function($item) {
                if ($item->productVariant && $item->productVariant->product) {
                    $attr = implode(' / ', array_values((array)$item->productVariant->attributes)) ?: 'Default';
                    return "{$item->productVariant->product->name} - {$attr} (x{$item->quantity})";
                }
                return "Unknown Item (x{$item->quantity})";
            })->join(', ');

            return [
                $order->id,
                $order->created_at->format('Y-m-d H:i:s'),
                $order->customer_name,
                $order->customer_phone,
                $order->delivery_address,
                $itemsSummary,
                $order->items->sum('quantity'),
                $order->subtotal,
                $order->discount_total,
                $order->delivery_fee,
                $order->customer_grand_total,
                strtoupper(str_replace('_', ' ', $order->status)),
                strtoupper(str_replace('_', ' ', $order->payment_status)),
            ];
        });

        $data->push([
            'Total',
            '',
            '',
            '',
            '',
            '',
            $this->orders->sum(fn($o) => $o->items->sum('quantity')),
            $this->orders->sum('subtotal'),
            $this->orders->sum('discount_total'),
            $this->orders->sum('delivery_fee'),
            $this->orders->sum('customer_grand_total'),
            '',
            '',
        ]);

        return $data;
    }

    public function headings(): array
    {
        return [
            'Order ID',
            'Date',
            'Customer Name',
            'Customer Phone',
            'Address',
            'Items Summary',
            'Total Items',
            'Subtotal (MMK)',
            'Discount (MMK)',
            'Delivery Fee (MMK)',
            'Grand Total (MMK)',
            'Order Status',
            'Payment Status',
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
            'G' => '#,##0', // Total Items
            'H' => '#,##0', // Subtotal
            'I' => '#,##0', // Discount
            'J' => '#,##0', // Delivery Fee
            'K' => '#,##0', // Grand Total
        ];
    }
}
