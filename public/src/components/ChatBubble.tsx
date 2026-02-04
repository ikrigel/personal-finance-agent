import { Box, Text, useMantineColorScheme } from '@mantine/core';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatBubble({ role, content }: ChatBubbleProps) {
  const isUser = role === 'user';
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  // Responsive maxWidth: 85% on mobile, 70% on larger screens
  const maxWidthMobile = '85%';
  const maxWidthDesktop = '70%';

  return (
    <Box
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '12px',
        paddingLeft: isUser ? 0 : '8px',
        paddingRight: isUser ? '8px' : 0,
      }}
    >
      <Box
        style={{
          maxWidth: `clamp(${maxWidthMobile}, 85vw, ${maxWidthDesktop})`,
          padding: '10px 14px',
          borderRadius: '16px',
          backgroundColor: isUser
            ? 'var(--mantine-color-blue-6)'
            : isDark
              ? 'var(--mantine-color-dark-5)'
              : 'var(--mantine-color-gray-1)',
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
        }}
      >
        <Text
          size="sm"
          style={{
            color: isUser ? 'white' : isDark ? 'var(--mantine-color-gray-3)' : 'var(--mantine-color-gray-9)',
            lineHeight: '1.4',
            margin: 0,
          }}
          component="div"
        >
          <div dangerouslySetInnerHTML={{ __html: content }} />
        </Text>
      </Box>
    </Box>
  );
}
