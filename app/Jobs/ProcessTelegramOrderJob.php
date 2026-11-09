<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Services\TelegramOrderProcessorService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessTelegramOrderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * @param  array<string, mixed>  $messageData
     */
    public function __construct(
        public int $shopId,
        public array $messageData
    ) {}

    public function handle(TelegramOrderProcessorService $processor): void
    {
        $processor->process($this->shopId, $this->messageData);
    }
}
