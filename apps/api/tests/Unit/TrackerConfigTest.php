<?php

namespace Tests\Unit;

use Tests\TestCase;

class TrackerConfigTest extends TestCase
{
    public function test_windows_tracker_asset_regex_matches_setup_executable(): void
    {
        $regex = (string) config('tracker.download.windows.asset_regex');

        $this->assertNotEmpty($regex);
        $this->assertSame(1, preg_match($regex, 'Horizon-Boost-Tracker-Setup-1.0.0.exe'));
    }
}
