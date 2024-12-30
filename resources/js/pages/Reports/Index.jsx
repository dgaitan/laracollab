import EmptyWithIcon from '@/components/EmptyWithIcon';
import useForm from '@/hooks/useForm';
import ContainerBox from '@/layouts/ContainerBox';
import Layout from '@/layouts/MainLayout';
import { money } from '@/utils/currency';
import { currentUrlParams } from '@/utils/route';
import { usePage } from '@inertiajs/react';
import {
  Box,
  Breadcrumbs,
  Button,
  Center,
  Checkbox,
  Group,
  MultiSelect,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { DatePickerInput, DatesProvider } from '@mantine/dates';
import { IconClock } from '@tabler/icons-react';
import dayjs from 'dayjs';
import round from 'lodash/round';

const Index = () => {
  let { tasks, clientCompanies, dropdowns } = usePage().props;

  const params = currentUrlParams();

  const [form, submit, updateValue] = useForm('get', route('reports.logged-time.index'), {
    projects: params.projects?.map(String) || [],
    users: params.users?.map(String) || [],
    dateRange:
      params.dateRange && params.dateRange[0] && params.dateRange[1]
        ? [dayjs(params.dateRange[0]).toDate(), dayjs(params.dateRange[1]).toDate()]
        : [dayjs().subtract(1, 'week').toDate(), dayjs().toDate()],
    completed: params.completed !== undefined ? params.completed : true,
    billable: params.billable !== undefined ? params.billable : true,
    everything: params.everything !== undefined ? params.everything : false,
  });

  const calculateHours = task => {
    if (task.time_logs.length === 0) {
      return 0;
    }

    let minutes = task.time_logs.reduce((acc, log) => acc + log.minutes, 0);
    return minutes / 60;
  };

  return (
    <>
      <Breadcrumbs
        fz={14}
        mb={30}
      >
        <div>Reports</div>
        <div>Logged time sum</div>
      </Breadcrumbs>

      <Title
        order={1}
        mb={20}
      >
        Logged time sum
      </Title>

      <ContainerBox
        px={35}
        py={25}
      >
        <form onSubmit={submit}>
          <Group justify='space-between'>
            <Group gap='xl'>
              <MultiSelect
                placeholder={form.data.projects.length ? null : 'Select projects'}
                required
                w={220}
                value={form.data.projects}
                onChange={values => updateValue('projects', values)}
                data={dropdowns.projects}
                error={form.errors.projects}
              />

              <MultiSelect
                placeholder={form.data.users.length ? null : 'Select users'}
                required
                w={220}
                value={form.data.users}
                onChange={values => updateValue('users', values)}
                data={dropdowns.users}
                error={form.errors.users}
              />

              <DatesProvider settings={{ timezone: 'utc' }}>
                <DatePickerInput
                  type='range'
                  valueFormat='MMM D'
                  placeholder='Pick dates range'
                  clearable
                  allowSingleDateInRange
                  miw={200}
                  value={form.data.dateRange}
                  onChange={dates => updateValue('dateRange', dates)}
                />
              </DatesProvider>

              <Checkbox
                label='Billable'
                checked={form.data.billable}
                onChange={event => updateValue('billable', event.currentTarget.checked)}
              />

              <Checkbox
                label='Completed'
                checked={form.data.completed}
                onChange={event => updateValue('completed', event.currentTarget.checked)}
              />

              <Checkbox
                label="Include Everything?"
                checked={form.data.everything}
                onChange={event => updateValue('everything', event.currentTarget.checked)}
              />
            </Group>

            <Button
              type='submit'
              disabled={form.processing}
            >
              Submit
            </Button>
          </Group>
        </form>
      </ContainerBox>

      <Box mt='xl'>
        {Object.keys(tasks).length ? (
            <div>
                <Table
                    horizontalSpacing='xl'
                    verticalSpacing='md'
                    striped
                    highlightOnHover
                >
                    <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Task Name</Table.Th>
                        <Table.Th>Project</Table.Th>
                        <Table.Th>User</Table.Th>
                        <Table.Th>Time Logged</Table.Th>
                    </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                    {Object.values(tasks).map(task => (
                        <Table.Tr key={task.id}>
                        <Table.Td>{task.name}</Table.Td>
                        <Table.Td>{task.project.name}</Table.Td>
                        <Table.Td>{task.assigned_to_user?.name}</Table.Td>
                        <Table.Td>{round(calculateHours(task), 2).toFixed(2)} h</Table.Td>
                        </Table.Tr>
                    ))}
                    </Table.Tbody>
                </Table>
                <Text
                    fz={20}
                    fw={600}
                >
                    Total Hours: {round(Object.values(tasks).reduce((acc, task) => acc + calculateHours(task), 0), 2).toFixed(2)} h
                </Text>
            </div>
        ) : (
            <Center mih={300}>
                <EmptyWithIcon
                title='No logged time found'
                subtitle='Try changing selected filters'
                icon={IconClock}
                />
            </Center>
        )}
      </Box>
    </>
  );
};

Index.layout = page => <Layout title='Logged time'>{page}</Layout>;

export default Index;
