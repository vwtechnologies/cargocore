<?php

namespace Tests\Feature;

use Tests\TestCase;

class SecureTransportTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->app->instance('env', 'production');
        config()->set('app.url', 'https://cargocore.vwisdomtechnologies.com');
        config()->set('session.secure', true);
    }

    public function test_http_login_pages_redirect_before_starting_a_session(): void
    {
        $response = $this->get('http://cargocore.vwisdomtechnologies.com/login?next=%2Fpeople');

        $response->assertStatus(308)
            ->assertRedirect('https://cargocore.vwisdomtechnologies.com/login?next=%2Fpeople');
        $this->assertEmpty($response->headers->getCookies());
    }

    public function test_http_login_submissions_redirect_without_weakening_csrf_checks(): void
    {
        $response = $this->postJson('http://cargocore.vwisdomtechnologies.com/login', ['username' => 'TEST']);

        $response->assertStatus(308)->assertRedirect('https://cargocore.vwisdomtechnologies.com/login');
        $this->assertEmpty($response->headers->getCookies());
    }

    public function test_https_requests_can_obtain_a_session_and_csrf_token(): void
    {
        $response = $this->getJson('https://cargocore.vwisdomtechnologies.com/csrf-token');

        $response->assertOk()->assertJsonStructure(['token'])->assertCookie(config('session.cookie'));
        foreach ($response->headers->getCookies() as $cookie) {
            $this->assertTrue($cookie->isSecure());
        }
    }

    public function test_https_forwarded_by_a_trusted_proxy_does_not_redirect_in_a_loop(): void
    {
        $this->withServerVariables(['REMOTE_ADDR' => '127.0.0.1'])
            ->withHeader('X-Forwarded-Proto', 'https')
            ->getJson('http://cargocore.vwisdomtechnologies.com/csrf-token')
            ->assertOk()->assertJsonStructure(['token']);
    }

    public function test_untrusted_forwarded_headers_cannot_bypass_the_https_redirect(): void
    {
        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.20'])
            ->withHeader('X-Forwarded-Proto', 'https')
            ->get('http://cargocore.vwisdomtechnologies.com/login')
            ->assertStatus(308)->assertRedirect('https://cargocore.vwisdomtechnologies.com/login');
    }

    public function test_local_development_can_still_use_http(): void
    {
        $this->app->instance('env', 'local');

        $this->getJson('http://localhost/csrf-token')->assertOk()->assertJsonStructure(['token']);
    }
}
