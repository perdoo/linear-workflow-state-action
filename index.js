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

async function getOrCreateLabel(linearClient, label) {
  if (!label) {
    return null;
  }

  let labelId = await linearClient
    .issueLabels({
      filter: { name: { eq: label } },
    })
    .then((res) => (res.nodes.length ? res.nodes[0].id : null));

  if (!labelId) {
    labelId = await linearClient
      .issueLabelCreate({ name: label })
      .then((res) => res._issueLabel.id);
    core.info(`Created label ${label}.`);
  }

  const encodedLabelName = encodeURIComponent(label);
  const labelUrl = `https://linear.app/perdoo/label/${encodedLabelName}`;

  core.setOutput("url", labelUrl);

  return labelId;
}

async function moveIssues(toStateId, issues, label, labelId) {
  for (let i = 0; i < issues.nodes.length; i++) {
    const issue = issues.nodes[i];
    let payload = { stateId: toStateId };

    if (labelId) {
      const labels = await issue.labels();
      const labelIds = labels.nodes.map(({ id }) => id);

      if (!labelIds.includes(labelId)) {
        payload["labelIds"] = labelIds.concat([labelId]);
        core.info(`Adding label "${label}" to "${issue.title}".`);
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
    const label = core.getInput("label");
    core.setSecret("linearToken");

    const issues = await getIssues(linearClient, fromStateId);

    if (!issues.nodes.length) {
      core.info("No issues found in the given workflow state.");
      return;
    }

    const labelId = await getOrCreateLabel(linearClient, label);

    await moveIssues(toStateId, issues, label, labelId);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
