<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use ZipArchive;

#[Signature('app:backup-database')]
#[Description('Backups the SQLite database into a zip file and syncs with Google Drive')]
class BackupDatabase extends Command
{
    /**
     * Execute the console command.
     */
    public function handle()
    {
        Log::info("Starting database backup process...");

        // 1. Define paths
        $databasePath = database_path('database.sqlite');
        
        if (!File::exists($databasePath)) {
            $msg = "Database file not found at: {$databasePath}";
            $this->error($msg);
            Log::error($msg);
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
            
            $msg = "Successfully zipped database to: {$zipFilePath}";
            $this->info($msg);
            Log::info($msg);
        } else {
            $msg = "Failed to create local zip backup.";
            $this->error($msg);
            Log::error($msg);
            return Command::FAILURE;
        }

        // 4. Cleanup old local backups (Keep last 7 days)
        $this->cleanupOldLocalBackups($backupDir, 7);

        // 5. Upload to Google Drive
        $googleUploaded = false;
        try {
            $this->info("Uploading to Google Drive...");
            $fileStream = fopen($zipFilePath, 'r');
            Storage::disk('google')->put($zipFileName, $fileStream);
            if (is_resource($fileStream)) {
                fclose($fileStream);
            }
            $msg = "Successfully uploaded backup to Google Drive ({$zipFileName})";
            $this->info($msg);
            Log::info($msg);
            $googleUploaded = true;

            // 6. Cleanup old backups on Google Drive (Keep last 7 days)
            $this->cleanupOldBackupsOnDrive(7);

        } catch (\Exception $e) {
            $msg = "Failed to upload to Google Drive: " . $e->getMessage();
            $this->error($msg);
            Log::error($msg);
            $this->warn("Local backup is preserved at: {$zipFilePath}");
            return Command::FAILURE;
        }

        return Command::SUCCESS;
    }

    private function cleanupOldLocalBackups(string $dir, int $daysToKeep)
    {
        try {
            $files = File::files($dir);
            $deletedCount = 0;

            foreach ($files as $file) {
                if (!str_starts_with($file->getFilename(), 'shoptracker_backup_')) continue;

                $fileMTime = $file->getMTime();
                if (now()->diffInDays(now()->setTimestamp($fileMTime)) > $daysToKeep) {
                    File::delete($file->getRealPath());
                    $deletedCount++;
                }
            }

            if ($deletedCount > 0) {
                $this->info("Cleaned up {$deletedCount} old local backup(s).");
            }
        } catch (\Exception $e) {
            Log::warning("Could not cleanup old local backups: " . $e->getMessage());
        }
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
                $msg = "Cleaned up {$deletedCount} old backup(s) from Google Drive.";
                $this->info($msg);
                Log::info($msg);
            }
        } catch (\Exception $e) {
            $msg = "Could not cleanup old backups on Drive: " . $e->getMessage();
            $this->error($msg);
            Log::warning($msg);
        }
    }
}

