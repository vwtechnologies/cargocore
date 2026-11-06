<?php

namespace App\Console\Commands;

use App\Models\Role;
use App\Models\User;
use App\Modules\Shared\Audit;
use App\Modules\Shared\UppercaseData;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class CreateAdministrator extends Command
{
    protected $signature = 'erp:create-admin {--username=} {--name=}';

    protected $description = 'Create a Super Admin with a password read from a hidden prompt or stdin; no default password';

    public function handle(): int
    {
        $username = UppercaseData::text($this->option('username') ?: $this->ask('Username'));
        $name = UppercaseData::text($this->option('name') ?: $this->ask('Full name'));
        $password = $this->input->isInteractive() ? $this->secret('Password (12+ characters, letters and numbers)') : trim(stream_get_contents(STDIN));
        $validator = Validator::make(compact('username', 'name', 'password'), ['username' => 'required|string|max:80|alpha_dash|unique:users', 'name' => 'required|string|max:255', 'password' => ['required', Password::min(12)->letters()->numbers()]]);
        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }
        $role = Role::where('name', 'Super Admin')->first();
        if (! $role) {
            $this->error('Run php artisan db:seed first.');

            return self::FAILURE;
        }
        $user = User::create(['username' => $username, 'name' => $name, 'password' => $password, 'role_id' => $role->id, 'status' => true, 'must_change_password' => false]);
        Audit::record('bootstrap', 'users', $user->id, [], ['username' => $user->username]);
        $this->info('Administrator created. Sign in with the assigned username and password.');

        return self::SUCCESS;
    }
}
