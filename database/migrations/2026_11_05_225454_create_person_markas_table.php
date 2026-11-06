<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('person_markas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('person_id')->constrained('people')->restrictOnDelete();
            $table->foreignId('marka_id')->constrained('markas')->restrictOnDelete();
            $table->boolean('status')->default(true);
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();
            $table->softDeletes();
            $table->unsignedTinyInteger('assignment_guard')->nullable()->storedAs('CASE WHEN deleted_at IS NULL THEN 1 ELSE NULL END');
            $table->unique(['person_id', 'marka_id', 'assignment_guard'], 'person_markas_unique_assignment');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('person_markas');
    }
};
