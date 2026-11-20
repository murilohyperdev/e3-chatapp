<?php

namespace Tests\Unit;

use App\Http\Resources\AlertResource;
use App\Models\Alert;
use App\Models\AlertResponse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

class AlertResourceTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_ended_alert_snapshot_keeps_its_responses_and_end_time(): void
    {
        $alert = Alert::factory()->ended()->create();
        AlertResponse::factory()->create(['alert_id' => $alert->id, 'square' => 'd']);

        $data = (new AlertResource($alert->fresh()))->toArray(new Request);

        $this->assertSame('ended', $data['status']);
        $this->assertNotNull($data['ended_at']);
        $this->assertCount(1, $data['responses']);
        $this->assertSame('d', $data['responses'][0]['square']);
    }

    public function test_an_active_alert_snapshot_has_no_end_time(): void
    {
        $alert = Alert::factory()->create();

        $data = (new AlertResource($alert->fresh()))->toArray(new Request);

        $this->assertSame('active', $data['status']);
        $this->assertNull($data['ended_at']);
        $this->assertSame([], $data['responses']);
    }
}
