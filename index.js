import * as core from "@actions/core";
import { each } from "lodash-es";
import { LinearClient } from "@linear/sdk";

const ESCAPE = {
  ">": "&gt;",
  "<": "&lt;",
  "&": "&amp;",
  "\r\n": " ",
  "\n": " ",
  "\r": " ",
};
const ESPACE_REGEX = new RegExp(Object.keys(ESCAPE).join("|"), "gi");

const apiKey = core.getInput("linearApiKey");
const linearClient = new LinearClient({ apiKey });
const fromStateId = core.getInput("fromStateId");
const toStateId = core.getInput("toStateId");
const labelName = core.getInput("label");

core.setSecret("linearApiKey");

async function run() {
  try {
    const issues = await getIssues();

    if (!issues.nodes.length) {
      core.info("No issues found in the given workflow state.");
      return;
    }

    const newLabelId = await createLabel();

    await updateIssues(issues, newLabelId);

    if (newLabelId) {
      const storyList = await formatIssuesForSlack(newLabelId);
      core.setOutput("issue-list", storyList);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function getIssues() {
  // TODO: Recursively fetch all pages here. Default page length is 50 which
  // should be enough for most use cases.
  const issues = await linearClient.issues({
    filter: {
      state: { id: { eq: fromStateId } },
    },
  });

  return issues;
}

async function createLabel() {
  if (!labelName) {
    return null;
  }

  // TODO: Handle case when label already exists as this currently thows an error
  const response = await linearClient.issueLabelCreate({ name: labelName });
  core.info(`Created label ${labelName}`);

  const labelUrl = `https://linear.app/perdoo/team/ENG/label/${encodeURIComponent(
    labelName
  )}`;

  core.setOutput("url", labelUrl);
  core.setOutput("label-created", Boolean(labelName));

  return response._issueLabel.id;
}

async function updateIssues(issues, newLabelId) {
  each(issues.nodes, async (issue) => {
    let payload = { stateId: toStateId };

    if (newLabelId) {
      const labels = await issue.labels();
      const labelIds = labels.nodes.map(({ id }) => id);
      if (!labelIds.includes(newLabelId)) {
        payload["labelIds"] = labelIds.concat([newLabelId]);
        core.info(`Adding label "${labelName}" to "${issue.title}".`);
      }
    }

    issue.update(payload);

    core.info(
      `Moved "${issue.title}" from state ${fromStateId} to ${toStateId}.`
    );
  });
}

const escapeText = (text) =>
  text.replace(ESPACE_REGEX, (match) => ESCAPE[match]);

const formatIssues = (issues) =>
  issues
    .map(({ title, url }) => `- <${url}|${escapeText(title)}>`)
    .join("\n") || "_No tickets_";

const formatIssuesForSlack = async (labelId) => {
  const label = await linearClient.issueLabel(labelId);
  const bugs = await label.issues({
    filter: { labels: { name: { eq: "Bug" } } },
  });
  const chores = await label.issues({
    filter: { labels: { name: { eq: "Chore" } } },
  });
  const features = await label.issues({
    filter: { labels: { every: { name: { nin: ["Bug", "Chore"] } } } },
  });

  return `
  *Features*\n${formatIssues(features.nodes)}

  *Bugfixes*\n${formatIssues(bugs.nodes)}

  *Chores*\n${formatIssues(chores.nodes)}
  `;
};

run();
