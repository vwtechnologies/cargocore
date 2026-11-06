<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

abstract class Record extends Model
{
    use HasFactory, SoftDeletes;

    protected $guarded = ['id', 'default_guard', 'name_guard', 'display_order_guard'];

    protected $hidden = ['default_guard', 'name_guard', 'display_order_guard', 'deleted_at'];

    protected function casts(): array
    {
        return ['status' => 'boolean', 'version' => 'integer', 'is_default' => 'boolean'];
    }
}
