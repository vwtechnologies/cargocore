<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PersonMarka extends Record
{
    protected $guarded = ['id', 'assignment_guard'];

    protected $hidden = ['assignment_guard', 'deleted_at'];

    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }

    public function marka(): BelongsTo
    {
        return $this->belongsTo(Marka::class);
    }
}
