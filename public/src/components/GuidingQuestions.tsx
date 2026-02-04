import { Text, Accordion, Button, Flex } from '@mantine/core';
import { ChevronDown } from 'lucide-react';

interface GuidingQuestionsProps {
  questions: string[];
  onQuestionClick: (question: string) => void;
}

export default function GuidingQuestions({ questions, onQuestionClick }: GuidingQuestionsProps) {
  return (
    <Flex direction="column" w={'100%'} gap="sm" px={{ base: 0, sm: 'xs' }}>
      <Text size="sm" fw={500} c="dimmed" style={{ fontSize: 'clamp(0.75rem, 1.5vw, 0.875rem)' }}>
        Example questions - click to select:
      </Text>
      <Accordion
        defaultValue={null}
        chevron={<ChevronDown size={16} />}
        styles={{
          control: {
            padding: '10px 14px',
            '&:hover': {
              backgroundColor: 'var(--mantine-color-gray-1)',
            },
            '@media (max-width: 576px)': {
              padding: '8px 12px',
            },
          },
          item: {
            borderColor: 'var(--mantine-color-gray-2)',
            marginBottom: '8px',
          },
          label: {
            fontSize: 'clamp(0.875rem, 2vw, 1rem)',
          },
        }}
      >
        <Accordion.Item value="all-questions">
          <Accordion.Control>
            <Text size="sm" fw={500} style={{ fontSize: 'clamp(0.875rem, 2vw, 1rem)' }}>
              All Guiding Questions ({questions.length})
            </Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Flex direction="column" gap="xs">
              {questions.map((question, index) => (
                <Button
                  key={index}
                  variant="light"
                  color="green"
                  size="sm"
                  fullWidth
                  justify="flex-start"
                  onClick={() => onQuestionClick(question)}
                  styles={{
                    label: {
                      whiteSpace: 'normal',
                      textAlign: 'left',
                      fontSize: 'clamp(0.75rem, 1.5vw, 0.875rem)',
                      lineHeight: '1.4',
                      padding: '4px 8px',
                    },
                  }}
                >
                  <span style={{ marginRight: '8px', fontWeight: 'bold', minWidth: '20px', flexShrink: 0 }}>
                    {index + 1}.
                  </span>
                  {question}
                </Button>
              ))}
            </Flex>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Flex>
  );
}
