<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Document extends Record
{
    protected $hidden = ['path', 'sha256', 'deleted_at'];

    protected function casts(): array
    {
        return array_merge(parent::casts(), ['expires_on' => 'date:Y-m-d']);
    }

    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }
}
