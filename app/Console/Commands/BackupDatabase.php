<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\File;
use ZipArchive;

#[Signature('app:backup-database')]
#[Description('Backups the SQLite database into a zip file')]
class BackupDatabase extends Command
{
    /**
     * Execute the console command.
     */
    public function handle()
    {
        // 1. Define paths
        $databasePath = database_path('database.sqlite');
        
        if (!File::exists($databasePath)) {
            $this->error("Database file not found at: {$databasePath}");
            return Command::FAILURE;
        }

        // Create backups directory if it doesn't exist
        $backupDir = storage_path('app/backups');
        if (!File::exists($backupDir)) {
            File::makeDirectory($backupDir, 0755, true);
        }

        // 2. Generate backup filename
        $timestamp = now()->format('Y-m-d_H-i-s');
        $zipFileName = "shoptracker_backup_{$timestamp}.zip";
        $zipFilePath = $backupDir . '/' . $zipFileName;

        // 3. Zip the database
        $zip = new ZipArchive();
        if ($zip->open($zipFilePath, ZipArchive::CREATE | ZipArchive::OVERWRITE) === true) {
            $zip->addFile($databasePath, 'database.sqlite');
            $zip->close();
            
            $this->info("Successfully zipped database to: {$zipFilePath}");
        } else {
            $this->error("Failed to create zip file.");
            return Command::FAILURE;
        }

        // 4. Upload to Google Drive
        try {
            $this->info("Uploading to Google Drive...");
            $fileStream = fopen($zipFilePath, 'r');
            Storage::disk('google')->put($zipFileName, $fileStream);
            if (is_resource($fileStream)) {
                fclose($fileStream);
            }
            $this->info("Successfully uploaded backup to Google Drive!");

            // 5. Cleanup local backup
            File::delete($zipFilePath);
            $this->info("Cleaned up local zip file.");

        } catch (\Exception $e) {
            $this->error("Failed to upload to Google Drive: " . $e->getMessage());
            return Command::FAILURE;
        }

        // 6. Cleanup old backups on Google Drive (Keep last 7 days)
        $this->cleanupOldBackupsOnDrive(7);

        return Command::SUCCESS;
    }

    private function cleanupOldBackupsOnDrive(int $daysToKeep)
    {
        try {
            $files = Storage::disk('google')->files();
            $deletedCount = 0;

            foreach ($files as $file) {
                // Ignore files that are not backups
                if (!str_starts_with($file, 'shoptracker_backup_')) continue;

                $lastModified = Storage::disk('google')->lastModified($file);
                
                if (now()->diffInDays(now()->setTimestamp($lastModified)) > $daysToKeep) {
                    Storage::disk('google')->delete($file);
                    $deletedCount++;
                }
            }

            if ($deletedCount > 0) {
                $this->info("Cleaned up {$deletedCount} old backup(s) from Google Drive.");
            }
        } catch (\Exception $e) {
            $this->error("Could not cleanup old backups on Drive: " . $e->getMessage());
        }
    }
}

