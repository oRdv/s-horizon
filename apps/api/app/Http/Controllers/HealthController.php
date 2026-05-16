<?php

namespace App\Http\Controllers;

use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $database = $this->databaseStatus();
        $jwtSecret = (string) config('jwt.secret');

        $payload = [
            'ok' => $database['ok'] && $jwtSecret !== '',
            'app' => [
                'name' => config('app.name'),
                'environment' => app()->environment(),
                'debug' => (bool) config('app.debug'),
                'url' => config('app.url'),
                'config_cached' => app()->configurationIsCached(),
                'routes_cached' => app()->routesAreCached(),
            ],
            'frontend' => [
                'url' => config('payments.frontend_url'),
            ],
            'database' => $database,
            'jwt' => [
                'issuer' => config('jwt.issuer'),
                'secret_configured' => $jwtSecret !== '',
                'access_ttl' => config('jwt.access_ttl'),
                'refresh_ttl' => config('jwt.refresh_ttl'),
            ],
            'mail' => [
                'mailer' => config('mail.default'),
                'host' => config('mail.mailers.smtp.host'),
                'port' => config('mail.mailers.smtp.port'),
                'scheme' => config('mail.mailers.smtp.scheme'),
                'username' => $this->mask((string) config('mail.mailers.smtp.username')),
                'from_address' => config('mail.from.address'),
                'from_name' => config('mail.from.name'),
            ],
        ];

        return response()->json($payload, $payload['ok'] ? 200 : 503);
    }

    /**
     * @return array<string, mixed>
     */
    private function databaseStatus(): array
    {
        $connectionName = config('database.default');
        $connection = config("database.connections.{$connectionName}", []);

        $status = [
            'ok' => false,
            'connection' => $connectionName,
            'driver' => $connection['driver'] ?? null,
            'host' => $connection['host'] ?? null,
            'port' => $connection['port'] ?? null,
            'database' => $connection['database'] ?? null,
            'username' => $this->mask((string) ($connection['username'] ?? '')),
            'url_configured' => filled($connection['url'] ?? null),
            'ssl_ca_configured' => filled($this->mysqlSslCa($connection)),
            'migrations_table' => false,
            'users_table' => false,
            'landing_boosters_table' => false,
            'migrations_ran' => null,
            'error' => null,
        ];

        try {
            DB::connection()->getPdo();

            $status['migrations_table'] = Schema::hasTable('migrations');
            $status['users_table'] = Schema::hasTable('users');
            $status['landing_boosters_table'] = Schema::hasTable('landing_boosters');
            $status['migrations_ran'] = $status['migrations_table']
                ? DB::table('migrations')->count()
                : 0;
            $status['ok'] = $status['users_table'] && $status['migrations_table'];
        } catch (QueryException $exception) {
            $status['error'] = $this->databaseErrorMessage($exception);
        } catch (Throwable) {
            $status['error'] = 'database_unavailable';
        }

        return $status;
    }

    private function databaseErrorMessage(QueryException $exception): string
    {
        $message = $exception->getMessage();

        if (str_contains($message, 'Access denied')) {
            return 'access_denied';
        }

        if (str_contains($message, 'Unknown database')) {
            return 'unknown_database';
        }

        if (str_contains($message, 'could not find driver')) {
            return 'missing_database_driver';
        }

        return 'query_exception';
    }

    private function mask(string $value): ?string
    {
        if ($value === '') {
            return null;
        }

        if (str_contains($value, '@')) {
            [$name, $domain] = explode('@', $value, 2);

            return substr($name, 0, 2).'***@'.$domain;
        }

        return substr($value, 0, 3).'***';
    }

    /**
     * @param  array<string, mixed>  $connection
     */
    private function mysqlSslCa(array $connection): mixed
    {
        $options = $connection['options'] ?? [];

        if (! is_array($options)) {
            return null;
        }

        if (defined('\Pdo\Mysql::ATTR_SSL_CA')) {
            $attribute = constant('\Pdo\Mysql::ATTR_SSL_CA');
        } elseif (defined('PDO::MYSQL_ATTR_SSL_CA')) {
            $attribute = constant('PDO::MYSQL_ATTR_SSL_CA');
        } else {
            return null;
        }

        return $options[$attribute] ?? null;
    }
}
