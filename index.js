import * as core from "@actions/core";
import { LinearClient } from "@linear/sdk";

async function getIssues(linearClient, fromStateId) {
  const issues = await linearClient.issues({
    first: 100,
    filter: {
      state: { id: { eq: fromStateId } },
    },
  });

  return issues;
}

async function createLabel(linearClient, labelName) {
  if (!labelName) {
    return null;
  }

  // TODO: Handle case when label already exists as this currently thows an error
  const response = await linearClient.issueLabelCreate({ name: labelName });
  core.info(`Created label ${labelName}.`);

  const encodedLabelName = encodeURIComponent(labelName);
  const labelUrl = `https://linear.app/perdoo/label/${encodedLabelName}`;

  core.setOutput("url", labelUrl);
  core.setOutput("label-created", true);

  return response._issueLabel.id;
}

async function moveIssues(toStateId, issues, labelId) {
  for (let i = 0; i < issues.nodes.length; i++) {
    const issue = issues.nodes[i];
    let payload = { stateId: toStateId };

    if (labelId) {
      const labels = await issue.labels();
      const labelIds = labels.nodes.map(({ id }) => id);

      if (!labelIds.includes(labelId)) {
        payload["labelIds"] = labelIds.concat([labelId]);
        core.info(`Adding label "${labelName}" to "${issue.title}".`);
      }
    }

    await issue.update(payload);

    core.info(`Moved "${issue.title}".`);
  }
}

async function run() {
  try {
    const linearToken = core.getInput("linearToken");
    const linearClient = new LinearClient({ apiKey: linearToken });
    const fromStateId = core.getInput("fromStateId");
    const toStateId = core.getInput("toStateId");
    const labelName = core.getInput("label");
    core.setSecret("linearToken");

    const issues = await getIssues(linearClient, fromStateId);

    if (!issues.nodes.length) {
      core.info("No issues found in the given workflow state.");
      return;
    }

    const newLabelId = await createLabel(linearClient, labelName);

    await moveIssues(toStateId, issues, newLabelId);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
