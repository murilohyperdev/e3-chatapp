<?php

namespace App\Http\Controllers;

use App\Http\Resources\DirectoryUserResource;
use App\Models\User;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DirectoryController extends Controller
{
    private const PER_PAGE = 12;

    public function index(): AnonymousResourceCollection
    {
        // Select only what the resource exposes: private columns never leave the database.
        $users = User::query()
            ->select(['id', 'name', 'avatar_path', 'role'])
            ->orderBy('name')
            ->orderBy('id')
            ->paginate(self::PER_PAGE);

        return DirectoryUserResource::collection($users);
    }
}
