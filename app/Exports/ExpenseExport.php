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

class ExpenseExport implements FromQuery, WithHeadings, WithMapping, ShouldAutoSize, WithStyles, WithColumnFormatting, WithEvents
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

    public function map($expense): array
    {
        return [
            $expense->incurred_at ? $expense->incurred_at->format('Y-m-d') : '',
            $expense->title,
            $expense->category ?? '-',
            $expense->amount,
            $expense->note ?? '-',
        ];
    }

    public function headings(): array
    {
        return [
            'Date Incurred',
            'Title',
            'Category',
            'Amount',
            'Note',
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
            'D' => '#,##0',
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                
                // Add Total Row via SQL Aggregation to avoid memory leak
                $totals = (clone $this->query)->selectRaw('
                    SUM(amount) as sum_amount
                ')->first();
                
                $rowIndex = $sheet->getHighestRow() + 1;

                $sheet->setCellValue('A' . $rowIndex, 'Total');
                $sheet->setCellValue('D' . $rowIndex, $totals->sum_amount ?? 0);

                $sheet->getStyle('A' . $rowIndex . ':E' . $rowIndex)->applyFromArray([
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
