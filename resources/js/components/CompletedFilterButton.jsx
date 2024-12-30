import { reloadWithQuery, reloadWithoutQueryParams } from "@/utils/route";
import { ActionIcon, Tooltip } from "@mantine/core";
import { useDidUpdate, useDisclosure } from "@mantine/hooks";
import { IconCheckbox } from "@tabler/icons-react";

export default function ArchivedFilterButton() {
  const [selected, { toggle }] = useDisclosure(
    route().params?.completed !== undefined,
  );

  useDidUpdate(() => {
    if (selected) reloadWithQuery({ completed: 1 });
    else reloadWithoutQueryParams({ exclude: ["completed"] });
  }, [selected]);

  return (
    <Tooltip label="Completed" openDelay={500} withArrow>
      <ActionIcon
        variant={selected ? "filled" : "default"}
        color={selected ? "green" : ""}
        size="lg"
        onClick={toggle}
      >
        <IconCheckbox style={{ width: "60%", height: "60%" }} stroke={1.5} />
      </ActionIcon>
    </Tooltip>
  );
}
