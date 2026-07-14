import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env first
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { DotnetApiClient } from '../src/integrations/dotnet/dotnet-api.client';
import { env } from '../src/config/env';

function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const val = args[i + 1];
      if (val && !val.startsWith('--')) {
        parsed[key] = val;
        i++;
      } else {
        parsed[key] = 'true';
      }
    }
  }
  return parsed;
}

function printUsage() {
  console.error(`
Usage:
  npx ts-node tools/manage-worklog.ts --action <create|update|delete> --token <JWT> [options]

Options:
  --id <id>                 Worklog ID (Required for 'update' and 'delete')
  --what <text>             Work done description (Required for 'create')
  --how <text>              How work was done (Optional)
  --start <datetime>        Start time in ISO format (Optional, defaults to current time)
  --end <datetime>          End time in ISO format (Optional, defaults to current time + 1 hour)
  --comment <text>          Additional comment (Optional)
  --task <text>             Task name (Optional, defaults to "General")
  --realization <number>    Realization time in minutes (Optional)

Examples:
  # Create a worklog
  npx ts-node tools/manage-worklog.ts --action create --token MY_TOKEN --what "Code review and bug fixes" --start "2026-07-14T09:00:00" --end "2026-07-14T10:00:00"

  # Update a worklog
  npx ts-node tools/manage-worklog.ts --action update --token MY_TOKEN --id 123 --what "Code review and bug fixes (updated)"

  # Delete a worklog
  npx ts-node tools/manage-worklog.ts --action delete --token MY_TOKEN --id 123
`);
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  const action = args.action;
  const token = args.token;

  if (!action || !['create', 'update', 'delete'].includes(action)) {
    console.error('Error: Invalid or missing action.');
    printUsage();
    process.exit(1);
  }

  if (!token) {
    console.error('Error: Missing --token argument.');
    printUsage();
    process.exit(1);
  }

  const client = new DotnetApiClient();
  console.log(`\n======================================================`);
  console.log(`Worklog Manager CLI`);
  console.log(`API Base URL: ${env.DOTNET_API_BASE_URL}`);
  console.log(`Action: ${action.toUpperCase()}`);
  console.log(`======================================================`);

  try {
    if (action === 'create') {
      const what = args.what;
      if (!what) {
        console.error('Error: Missing --what parameter for create action.');
        printUsage();
        process.exit(1);
      }

      const payload = {
        What: what,
        How: args.how,
        StartTime: args.start || new Date().toISOString(),
        EndTime: args.end || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        Comment: args.comment,
        TaskName: args.task || 'General',
        RealizationTime: args.realization ? parseInt(args.realization, 10) : undefined,
      };

      console.log('Sending payload:', JSON.stringify(payload, null, 2));
      const res = await client.createWorklog(token, payload);
      console.log('\nResponse Success!');
      console.log(JSON.stringify(res, null, 2));

    } else if (action === 'update') {
      const id = args.id;
      if (!id) {
        console.error('Error: Missing --id parameter for update action.');
        printUsage();
        process.exit(1);
      }

      const payload: Record<string, any> = {};
      if (args.what) payload.What = args.what;
      if (args.how) payload.How = args.how;
      if (args.start) payload.StartTime = args.start;
      if (args.end) payload.EndTime = args.end;
      if (args.comment) payload.Comment = args.comment;
      if (args.task) payload.TaskName = args.task;
      if (args.realization) payload.RealizationTime = parseInt(args.realization, 10);

      console.log(`Updating worklog ID: ${id}`);
      console.log('Sending update payload:', JSON.stringify(payload, null, 2));
      const res = await client.updateWorklog(token, id, payload);
      console.log('\nResponse Success!');
      console.log(JSON.stringify(res, null, 2));

    } else if (action === 'delete') {
      const id = args.id;
      if (!id) {
        console.error('Error: Missing --id parameter for delete action.');
        printUsage();
        process.exit(1);
      }

      console.log(`Deleting worklog ID: ${id}`);
      const res = await client.deleteWorklog(token, id);
      console.log('\nResponse Success!');
      console.log(JSON.stringify(res, null, 2));
    }
  } catch (error: any) {
    console.error('\nAPI Request Failed:');
    console.error(error.message);
    if (error.details) {
      console.error('Details:', JSON.stringify(error.details, null, 2));
    }
    process.exit(1);
  }
}

run();
