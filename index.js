const core = require("@actions/core");
import { each } from "lodash";
import { LinearClient } from "@linear/sdk";

async function run() {
  try {
    const apiKey = core.getInput("linearApiKey");
    const linearClient = new LinearClient({ apiKey });
    const fromStateId = core.getInput("fromStateId");
    const toStateId = core.getInput("toStateId");

    core.setSecret("linearApiKey");

    // TODO: Recursively fetch all pages here. Default page length is 50 which should be enough for most use cases
    const issues = await linearClient.issues({
      filter: {
        state: { id: { eq: fromStateId } },
      },
    });

    each(issues.nodes, (issue) => {
      issue.update({ stateId: toStateId });
      core.info(
        `Moved ${issue.title} from state ${fromStateId} to ${toStateId}.`
      );
    });

    if (!issues.nodes.length) {
      core.info("No stories found in the given workflow state.");
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
