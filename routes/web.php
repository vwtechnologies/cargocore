<?php

use App\Http\Controllers\Api\AccessController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\PersonCompanyRoleController;
use App\Http\Controllers\Api\RecordController;
use App\Http\Controllers\Api\SessionController;
use App\Http\Middleware\EnsureAccountReady;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->get('/api/v1/session', [SessionController::class, 'show']);
Route::middleware(['auth:sanctum', EnsureAccountReady::class])->prefix('api/v1')->group(function () {
    Route::post('associations/{association}/classifications/batch', [RecordController::class, 'batchClassifications'])->whereNumber('association');
    Route::match(['get', 'put'], 'people/{person}/company-roles/{company}', [PersonCompanyRoleController::class, 'handle'])->whereNumber(['person', 'company']);
    Route::get('people/{person}/user-account', [AccessController::class, 'personUser'])->whereNumber('person');
    Route::get('dashboard', [DashboardController::class, 'show']);
    Route::get('audit', [DashboardController::class, 'audit']);
    Route::match(['get', 'post'], 'users', [AccessController::class, 'users']);
    Route::get('users/linkable-people', [AccessController::class, 'linkablePeople']);
    Route::put('users/{id}', [AccessController::class, 'users'])->whereNumber('id');
    Route::match(['get', 'post'], 'roles', [AccessController::class, 'roles']);
    Route::put('roles/{id}', [AccessController::class, 'roles'])->whereNumber('id');
    Route::match(['get', 'put'], 'people/{person}/employee', [EmployeeController::class, 'handle'])->whereNumber('person');
    Route::get('people/{person}/documents/{document}/download', [DocumentController::class, 'download'])->whereNumber(['person', 'document']);
    Route::match(['get', 'post'], 'people/{person}/documents', [DocumentController::class, 'handle'])->whereNumber('person');
    Route::match(['post', 'delete'], 'people/{person}/documents/{id}', [DocumentController::class, 'handle'])->whereNumber(['person', 'id']);
    Route::match(['get', 'post', 'put', 'patch', 'delete'], '{parentEntity}/{parentId}/{entity}/{id?}', function (Request $request, string $parentEntity, int $parentId, string $entity, ?int $id = null) {
        return app(RecordController::class)->handle($request, $entity, $id, $parentEntity, $parentId);
    })->whereNumber(['parentId', 'id']);
    Route::match(['get', 'post', 'put', 'patch', 'delete'], '{entity}/{id?}', [RecordController::class, 'handle'])->whereNumber('id');
});
Route::get('/{path?}', fn () => view('app'))->where('path', '^(?!api/|sanctum/|user/).*')->name('app');
