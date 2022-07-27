import * as core from "@actions/core";
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

const linearToken = core.getInput("linearToken");
const linearClient = new LinearClient({ apiKey: linearToken });
const fromStateId = core.getInput("fromStateId");
const toStateId = core.getInput("toStateId");
const labelName = core.getInput("label");

core.setSecret("linearToken");

async function getIssues() {
  const issues = await linearClient.issues({
    first: 100,
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
  core.info(`Created label ${labelName}.`);

  const labelUrl = `https://linear.app/perdoo/team/ENG/label/${encodeURIComponent(
    labelName
  )}`;

  core.setOutput("url", labelUrl);
  core.setOutput("label-created", true);

  return response._issueLabel.id;
}

async function updateIssues(issues, newLabelId) {
  for (let i = 0; i < issues.nodes.length; i++) {
    const issue = issues.nodes[i];
    let payload = { stateId: toStateId };

    if (newLabelId) {
      const labels = await issue.labels();
      const labelIds = labels.nodes.map(({ id }) => id);
      if (!labelIds.includes(newLabelId)) {
        payload["labelIds"] = labelIds.concat([newLabelId]);
        core.info(`Adding label "${labelName}" to "${issue.title}".`);
      }
    }

    await issue.update(payload);

    core.info(
      `Moved "${issue.title}" from state ${fromStateId} to ${toStateId}.`
    );
  }
}

const formatIssuesForSlack = async (labelId) => {
  const label = await linearClient.issueLabel(labelId);
  const bugs = await getBugs(label);
  const chores = await getChores(label);
  const fastTracks = await getFastTracks(label);
  const projects = await getProjects(label);

  return `
*Fast Track*
${formatIssues(fastTracks)}

*Bugfixes*
${formatIssues(bugs)}

*Chores*
${formatIssues(chores)}

*Projects*
${formatProjects(projects)}
  `;
};

const getBugs = async (label) => {
  let issues = await label.issues({
    filter: { labels: { name: { eq: "Bug" } }, project: { null: true } },
  });

  return removeChildIssues(issues);
};

const getChores = async (label) => {
  let issues = await label.issues({
    filter: { labels: { name: { eq: "Chore" } }, project: { null: true } },
  });

  return removeChildIssues(issues);
};

const getFastTracks = async (label) => {
  let issues = await label.issues({
    filter: {
      labels: { every: { name: { nin: ["Bug", "Chore"] } } },
      project: { null: true },
    },
  });

  return removeChildIssues(issues);
};

const removeChildIssues = (issues) => {
  issues.nodes = issues.nodes.filter((issue) => issue._parent === undefined);
  return issues;
};

const getProjects = async (label) => {
  const issues = await label.issues({
    filter: { project: { null: false } },
  });
  const projects = {};

  for (let i = 0; i < issues.nodes.length; i++) {
    const issue = issues.nodes[i];
    if (!(issue._project.id in projects)) {
      projects[issue._project.id] = await issue.project;
    }
  }

  return Object.values(projects).sort(
    (first, second) => second.progress - first.progress
  );
};

const formatIssues = (issues) =>
  issues.nodes
    .map(({ title, url }) => `- <${url}|${escapeText(title)}>`)
    .join("\n") || "_No tickets_";

const escapeText = (text) =>
  text.replace(ESPACE_REGEX, (match) => ESCAPE[match]);

const formatProjects = (projects) =>
  projects
    .map(
      ({ name, url, progress }) =>
        `- <${url}|${escapeText(name)}> (${formatProgress(progress)})`
    )
    .join("\n") || "_No projects_";

const formatProgress = (progress) => (progress * 100).toFixed() + "%";

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
      const issueList = await formatIssuesForSlack(newLabelId);
      core.setOutput("issue-list", issueList);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
