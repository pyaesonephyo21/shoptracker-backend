<?php

namespace App\Console\Commands;

use Google\Client;
use Google\Service\Drive;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('app:google-drive-auth')]
#[Description('Helper command to generate a new Google Drive refresh token')]
class GoogleDriveAuth extends Command
{
    public function handle()
    {
        $clientId = config('filesystems.disks.google.clientId');
        $clientSecret = config('filesystems.disks.google.clientSecret');

        if (empty($clientId) || empty($clientSecret)) {
            $this->error('GOOGLE_DRIVE_CLIENT_ID or GOOGLE_DRIVE_CLIENT_SECRET is missing in .env');

            return Command::FAILURE;
        }

        $client = new Client;
        $client->setClientId($clientId);
        $client->setClientSecret($clientSecret);
        $client->setRedirectUri('urn:ietf:wg:oauth:2.0:oob');
        $client->setScopes([Drive::DRIVE, Drive::DRIVE_FILE]);
        $client->setAccessType('offline');
        $client->setPrompt('select_account consent');

        $authUrl = $client->createAuthUrl();

        $this->info("1. Open the following URL in your browser:\n");
        $this->line($authUrl);
        $this->newLine();

        $authCode = $this->ask('2. Log in, grant permissions, and paste the authorization code here');

        if (empty($authCode)) {
            $this->error('Authorization code cannot be empty.');

            return Command::FAILURE;
        }

        $accessToken = $client->fetchAccessTokenWithAuthCode($authCode);

        if (isset($accessToken['error'])) {
            $this->error('Failed to obtain access token: '.($accessToken['error_description'] ?? $accessToken['error']));

            return Command::FAILURE;
        }

        if (empty($accessToken['refresh_token'])) {
            $this->warn('No refresh token was returned. Make sure you set prompt=consent and select_account.');

            return Command::FAILURE;
        }

        $this->newLine();
        $this->info('=========================================');
        $this->info('SUCCESS! Add this to your .env file:');
        $this->line('GOOGLE_DRIVE_REFRESH_TOKEN='.$accessToken['refresh_token']);
        $this->info('=========================================');

        return Command::SUCCESS;
    }
}
