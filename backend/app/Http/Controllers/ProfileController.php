<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateProfileRequest;
use App\Http\Requests\UploadAvatarRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;

class ProfileController extends Controller
{
    public function update(UpdateProfileRequest $request, User $user): UserResource
    {
        $user->update($request->validated());

        return new UserResource($user);
    }

    public function uploadAvatar(UploadAvatarRequest $request, User $user): UserResource
    {
        $oldPath = $user->avatar_path;
        $newPath = $request->file('avatar')->store('avatars', 'public');

        // Save the new reference first, then delete the old file: a failure in between
        // can leave an unreferenced file but never a profile pointing at nothing.
        $user->forceFill(['avatar_path' => $newPath])->save();

        if ($oldPath) {
            Storage::disk('public')->delete($oldPath);
        }

        return new UserResource($user);
    }

    public function deleteAvatar(User $user): UserResource
    {
        Gate::authorize('update', $user);

        if ($user->avatar_path) {
            Storage::disk('public')->delete($user->avatar_path);
            $user->forceFill(['avatar_path' => null])->save();
        }

        return new UserResource($user);
    }
}
