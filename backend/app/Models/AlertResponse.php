<?php

namespace App\Models;

use App\Enums\Square;
use Database\Factories\AlertResponseFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Only the chosen square is mass assignable: the person and the alert always come
// from the session and the route, so a request body can never forge them.
#[Fillable(['square'])]
class AlertResponse extends Model
{
    /** @use HasFactory<AlertResponseFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['square' => Square::class];
    }

    /**
     * @return BelongsTo<Alert, $this>
     */
    public function alert(): BelongsTo
    {
        return $this->belongsTo(Alert::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
