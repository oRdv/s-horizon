<?php

namespace App\Services\Tracker;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

final class TrackerReleaseService
{
    /**
     * @return array<string,mixed>
     */
    public function metadata(string $platform): array
    {
        $platform = Str::lower($platform);

        if ($platform !== 'windows') {
            return $this->unavailable($platform, 'Plataforma nao suportada.');
        }

        try {
            return match ((string) config('tracker.download.provider', 'github')) {
                'generic' => $this->genericMetadata($platform),
                'local' => $this->localMetadata($platform),
                default => $this->githubMetadata($platform),
            };
        } catch (Throwable $exception) {
            Log::warning('tracker.release_lookup_failed', [
                'platform' => $platform,
                'provider' => config('tracker.download.provider'),
                'message' => $exception->getMessage(),
            ]);

            return $this->unavailable($platform, 'Nao foi possivel consultar o release publicado.');
        }
    }

    /**
     * @return array<string,mixed>
     */
    private function githubMetadata(string $platform): array
    {
        $cacheSeconds = max(0, (int) config('tracker.download.cache_seconds', 300));
        $cacheKey = "tracker.release.github.{$platform}.".md5(json_encode([
            config('tracker.download.github.owner'),
            config('tracker.download.github.repo'),
            config('tracker.download.github.tag'),
            config("tracker.download.{$platform}.asset_name"),
            config("tracker.download.{$platform}.asset_regex"),
        ], JSON_THROW_ON_ERROR));

        $resolver = fn (): array => $this->resolveGithubMetadata($platform);

        if ($cacheSeconds === 0) {
            return $resolver();
        }

        return Cache::remember($cacheKey, $cacheSeconds, $resolver);
    }

    /**
     * @return array<string,mixed>
     */
    private function resolveGithubMetadata(string $platform): array
    {
        $owner = (string) config('tracker.download.github.owner');
        $repo = (string) config('tracker.download.github.repo');
        $tag = config('tracker.download.github.tag');

        if ($owner === '' || $repo === '') {
            return $this->unavailable($platform, 'Repositorio de releases nao configurado.');
        }

        $endpoint = filled($tag)
            ? "https://api.github.com/repos/{$owner}/{$repo}/releases/tags/{$tag}"
            : "https://api.github.com/repos/{$owner}/{$repo}/releases/latest";

        $request = Http::acceptJson()
            ->withUserAgent('HorizonBoostTrackerReleaseResolver/1.0')
            ->timeout(8);

        $token = config('tracker.download.github.token');
        if (filled($token)) {
            $request = $request->withToken((string) $token);
        }

        $response = $request->get($endpoint);

        if ($response->failed()) {
            return $this->unavailable($platform, 'Release do Tracker nao encontrado no GitHub.');
        }

        $release = $response->json();
        if (! is_array($release)) {
            return $this->unavailable($platform, 'Resposta de release invalida.');
        }

        $asset = $this->findGithubAsset($platform, $release['assets'] ?? []);
        if (! $asset) {
            return $this->unavailable($platform, 'Instalador do Windows nao encontrado no release.');
        }

        $filename = (string) ($asset['name'] ?? config("tracker.download.{$platform}.filename"));
        $version = $this->normalizeVersion((string) ($release['tag_name'] ?? config('tracker.download.version')));

        return [
            'platform' => $platform,
            'provider' => 'github',
            'available' => true,
            'version' => $version,
            'filename' => $filename,
            'size_bytes' => isset($asset['size']) ? (int) $asset['size'] : null,
            'sha256' => $this->normalizeDigest($asset['digest'] ?? null) ?? config("tracker.download.{$platform}.sha256"),
            'content_type' => $asset['content_type'] ?? null,
            'published_at' => $release['published_at'] ?? null,
            'release_url' => $release['html_url'] ?? null,
            'direct_url' => $asset['browser_download_url'] ?? null,
            'error' => null,
        ];
    }

    /**
     * @param array<int,array<string,mixed>> $assets
     *
     * @return array<string,mixed>|null
     */
    private function findGithubAsset(string $platform, array $assets): ?array
    {
        $assetName = config("tracker.download.{$platform}.asset_name");
        if (filled($assetName)) {
            foreach ($assets as $asset) {
                if (($asset['name'] ?? null) === $assetName) {
                    return $asset;
                }
            }
        }

        $assetRegex = (string) config("tracker.download.{$platform}.asset_regex");
        if ($assetRegex !== '') {
            foreach ($assets as $asset) {
                $name = (string) ($asset['name'] ?? '');
                if ($name !== '' && @preg_match($assetRegex, $name) === 1) {
                    return $asset;
                }
            }
        }

        foreach ($assets as $asset) {
            $name = (string) ($asset['name'] ?? '');
            if (Str::contains(Str::lower($name), 'horizon-boost-tracker') && Str::endsWith(Str::lower($name), ['.exe', '.zip'])) {
                return $asset;
            }
        }

        return null;
    }

    /**
     * @return array<string,mixed>
     */
    private function genericMetadata(string $platform): array
    {
        $baseUrl = rtrim((string) config('tracker.download.generic.base_url'), '/');
        $filename = (string) config("tracker.download.{$platform}.filename");

        if ($baseUrl === '' || $filename === '') {
            return $this->unavailable($platform, 'Repositorio externo de releases nao configurado.');
        }

        return [
            'platform' => $platform,
            'provider' => 'generic',
            'available' => true,
            'version' => (string) config('tracker.download.version'),
            'filename' => $filename,
            'size_bytes' => null,
            'sha256' => config("tracker.download.{$platform}.sha256"),
            'content_type' => null,
            'published_at' => null,
            'release_url' => $baseUrl,
            'direct_url' => $baseUrl.'/'.rawurlencode($filename),
            'error' => null,
        ];
    }

    /**
     * @return array<string,mixed>
     */
    private function localMetadata(string $platform): array
    {
        $path = (string) config("tracker.download.{$platform}.path");
        $available = $path !== '' && File::exists($path);

        return [
            'platform' => $platform,
            'provider' => 'local',
            'available' => $available,
            'version' => (string) config('tracker.download.version'),
            'filename' => (string) config("tracker.download.{$platform}.filename"),
            'size_bytes' => $available ? File::size($path) : null,
            'sha256' => config("tracker.download.{$platform}.sha256"),
            'content_type' => null,
            'published_at' => null,
            'release_url' => null,
            'direct_url' => null,
            'path' => $path,
            'error' => $available ? null : 'Instalador local nao encontrado.',
        ];
    }

    /**
     * @return array<string,mixed>
     */
    private function unavailable(string $platform, string $message): array
    {
        return [
            'platform' => $platform,
            'provider' => (string) config('tracker.download.provider', 'github'),
            'available' => false,
            'version' => (string) config('tracker.download.version'),
            'filename' => (string) config("tracker.download.{$platform}.filename", 'Horizon-Boost-Tracker.exe'),
            'size_bytes' => null,
            'sha256' => config("tracker.download.{$platform}.sha256"),
            'content_type' => null,
            'published_at' => null,
            'release_url' => null,
            'direct_url' => null,
            'error' => $message,
        ];
    }

    private function normalizeVersion(string $version): string
    {
        return Str::of($version)->ltrim('v')->toString();
    }

    private function normalizeDigest(mixed $digest): ?string
    {
        if (! is_string($digest) || $digest === '') {
            return null;
        }

        return Str::startsWith($digest, 'sha256:') ? Str::after($digest, 'sha256:') : $digest;
    }
}
