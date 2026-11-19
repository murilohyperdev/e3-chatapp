import { Avatar, type AvatarProps } from '@mui/material'

interface UserAvatarProps extends Pick<AvatarProps, 'sx'> {
  name: string
  url: string | null
  size?: number
}

// Picture when there is one, otherwise the person's initial.
export function UserAvatar({ name, url, size = 40, sx }: UserAvatarProps) {
  return (
    <Avatar src={url ?? undefined} alt={name} sx={{ width: size, height: size, ...sx }}>
      {name.charAt(0).toUpperCase()}
    </Avatar>
  )
}
