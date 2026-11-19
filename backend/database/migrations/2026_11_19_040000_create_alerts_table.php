<?php

use App\Enums\Square;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alerts', function (Blueprint $table) {
            $table->id();
            // History survives a deleted administrator, so these only become null.
            $table->foreignId('started_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('ended_by')->nullable()->constrained('users')->nullOnDelete();
            // "Active" simply means ended_at IS NULL: one source of truth, no status column to disagree.
            $table->timestamp('ended_at')->nullable();
            // Bumped on every change so clients can ignore a stale snapshot.
            $table->unsignedInteger('revision')->default(1);
            $table->timestamps();
        });

        // At most ONE active alert. Every row with ended_at IS NULL maps to the same
        // constant key (true), so a second active row violates the unique index, even
        // when two requests race. Postgres-specific (partial + expression index).
        DB::statement('CREATE UNIQUE INDEX alerts_single_active ON alerts ((true)) WHERE ended_at IS NULL');

        Schema::create('alert_responses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('alert_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('square', 1);
            $table->timestamps();

            // One response per user per alert (also indexes lookups by alert).
            $table->unique(['alert_id', 'user_id']);
        });

        $allowed = implode(',', array_map(fn (string $value) => "'{$value}'", Square::values()));
        DB::statement("ALTER TABLE alert_responses ADD CONSTRAINT alert_responses_square_check CHECK (square IN ({$allowed}))");
    }

    public function down(): void
    {
        Schema::dropIfExists('alert_responses');
        Schema::dropIfExists('alerts');
    }
};
