<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('queue:prune-failed --hours=720')->daily();
Schedule::command('auth:clear-resets')->daily();
