<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use Illuminate\Support\Collection;

class ExpenseExport implements FromCollection, WithHeadings, ShouldAutoSize, WithStyles, WithColumnFormatting
{
    protected $expenses;

    public function __construct(Collection $expenses)
    {
        $this->expenses = $expenses;
    }

    public function collection()
    {
        $data = $this->expenses->map(function ($expense) {
            return [
                $expense->incurred_at ? $expense->incurred_at->format('Y-m-d') : '',
                $expense->title,
                $expense->category ?? '-',
                $expense->amount,
                $expense->note ?? '-',
            ];
        });

        $data->push([
            'Total',
            '',
            '',
            $this->expenses->sum('amount'),
            '',
        ]);

        return $data;
    }

    public function headings(): array
    {
        return [
            'Date Incurred',
            'Title',
            'Category',
            'Amount (MMK)',
            'Note',
        ];
    }

    public function styles(Worksheet $sheet)
    {
        // Set default row height for all data rows
        $sheet->getDefaultRowDimension()->setRowHeight(25);
        
        // Set header height
        $sheet->getRowDimension(1)->setRowHeight(30);

        // Vertically center all data
        $sheet->getStyle($sheet->calculateWorksheetDimension())->getAlignment()->setVertical(\PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_CENTER);

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

        // Style the total row at the very bottom
        $lastRow = $this->expenses->count() + 2; // +1 for header, +1 for total row
        $styles[$lastRow] = [
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
            'D' => '#,##0', // Amount
        ];
    }
}
