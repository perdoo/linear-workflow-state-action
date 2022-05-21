import * as core from "@actions/core";
import { each, remove } from "lodash-es";
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

async function run() {
  try {
    const apiKey = core.getInput("linearApiKey");
    const linearClient = new LinearClient({ apiKey });
    const fromStateId = core.getInput("fromStateId");
    const toStateId = core.getInput("toStateId");
    const completedAfter = Date.parse(core.getInput("completedAfter"));
    const labelName = core.getInput("label");

    core.setSecret("linearApiKey");

    // Fetch issues
    // TODO: Recursively fetch all pages here. Default page length is 50 which should be enough for most use cases
    const issues = await linearClient.issues({
      filter: {
        state: { id: { eq: fromStateId } },
      },
    });

    // Filter issues
    if (completedAfter) {
      remove(issues.nodes, (issue) => issue.completedAt < completedAfter);
    }

    if (!issues.nodes.length) {
      core.info("No stories found in the given workflow state.");
      return;
    }

    let newLabelId;
    // Create label
    if (labelName) {
      // TODO: Handle case when label already exists as this currently thows an error
      const labelResponse = await linearClient.issueLabelCreate({
        name: labelName,
      });
      newLabelId = labelResponse._issueLabel.id;
      core.info(`Created label ${labelName}`);
      const labelUrl = `https://linear.app/perdoo/team/ENG/label/${encodeURIComponent(
        labelName
      )}`;
      core.setOutput("url", labelUrl);
    }

    core.setOutput("label-created", Boolean(labelName));

    // Update issues
    each(issues.nodes, async (issue) => {
      let updatedIssue = {
        stateId: toStateId,
      };

      if (newLabelId) {
        const labels = await issue.labels();
        const labelIds = labels.nodes.map(({ id }) => id);
        if (!labelIds.includes(newLabelId)) {
          updatedIssue["labelIds"] = labelIds.concat([newLabelId]);
          core.info(`Adding label ${labelName} to ${issue.title}`);
        }
      }

      issue.update(updatedIssue);
      core.info(
        `Moved ${issue.title} from state ${fromStateId} to ${toStateId}.`
      );

      if (newLabelId) {
        core.setOutput("story-list", formatIssuesForSlack(newLabelId));
      }
    });
  } catch (error) {
    core.setFailed(error.message);
  }
}

const escapeText = (text) =>
  text.replace(ESPACE_REGEX, (match) => ESCAPE[match]);

const formatIssues = (issues) =>
  issues
    .map(({ title, url }) => `- <${url}|${escapeText(title)}>`)
    .join("\n") || "_No tickets_";

const formatIssuesForSlack = async (labelId) => {
  const label = linearClient.issueLabel(labelId);
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
  *Features*
  ${formatIssues(features.nodes)}

  *Bugfixes*
  ${formatIssues(bugs.nodes)}

  *Chores*
  ${formatIssues(chores.nodes)}
  `;
};

run();
