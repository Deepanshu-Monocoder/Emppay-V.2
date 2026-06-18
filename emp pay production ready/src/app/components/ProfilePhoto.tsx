interface Props {
  name: string;
  photoUrl?: string;
  size?: number;
}

export function ProfilePhoto({ name, photoUrl, size = 64 }: Props) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    );
  }

  // Fallback to letter avatar
  const parts = name.trim().split(' ');
  const initials = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2);
  const palettes = [
    { bg: '#EDE9FE', color: '#6D28D9' }, { bg: '#DBEAFE', color: '#1D4ED8' },
    { bg: '#D1FAE5', color: '#065F46' }, { bg: '#FEF3C7', color: '#92400E' },
    { bg: '#FCE7F3', color: '#9D174D' }, { bg: '#E0F2FE', color: '#075985' },
  ];
  const p = palettes[name.charCodeAt(0) % palettes.length];

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: p.bg,
        color: p.color,
        fontSize: size * 0.36,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {initials.toUpperCase()}
    </div>
  );
}
