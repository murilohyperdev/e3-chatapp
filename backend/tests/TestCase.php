<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Sanctum only starts a session for requests that come from a stateful
     * domain, so every test request pretends to come from the React dev server.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $this->withHeader('Origin', config('app.frontend_url'));
        $this->withHeader('Referer', config('app.frontend_url').'/');
    }
}
