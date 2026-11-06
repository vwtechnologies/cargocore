<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PersonContact extends Record
{
    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }
}
