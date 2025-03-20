import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import "dotenv/config"; // Load environment variables
import express from "express";
import cors from "cors";
import { z } from "zod";
import { IncomingMessage, ServerResponse } from "node:http";
import bodyParser from "body-parser";
// Import all the existing tools and functions
import * as requirementsApi from "./api/requirements.js";
import {
  generateRequirement,
  generateRequirementsFromDiscovery,
  guidedRequirementDiscovery,
  processDiscoveryResponse,
} from "./tools/discovery-tools.js";
import {
  createProject,
  findProjects,
  getProject,
  updateProject,
} from "./tools/project-tools.js";
import {
  createRequirement,
  deleteRequirement,
  listProjectRequirements,
  updateRequirement,
} from "./tools/requirement-tools.js";
import {
  completeTask,
  createTask,
  deleteTask,
  getTask,
  listChildTasks,
  listProjectRootTasks,
  listProjectTasks,
  updateTask,
} from "./tools/tasks-tools.js";

// Create an MCP server
const server = new McpServer(
  {
    name: "Task and Requirement Planner",
    version: "1.0.0",
  },
  {
    instructions:
      "Use these tools to help the user plan their tasks and requirements for large programming projects.",
  }
);

// Tool: Create a new project
server.tool(
  "create-project",
  "Create a new project",
  {
    name: z.string().min(1).describe("Name of the project"),
    description: z.string().optional().describe("Detailed description of the project"),
  },
  async ({ name, description }) => {
    const result = await createProject({ name, description });
    if (!result.success) {
      return {
        content: [{ type: "text", text: result.error || "Failed to create project" }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: `Created project: ${result.project?.name} (ID: ${result.project?.id})` }],
    };
  }
);

// Tool: List all projects
server.tool(
  "list-projects",
  "List all projects",
  {
    searchTerm: z.string().optional().describe("Optional search term to filter projects"),
  },
  async ({ searchTerm }) => {
    const result = await findProjects({ searchTerm });
    if (!result.success) {
      return {
        content: [{ type: "text", text: result.error || "Failed to list projects" }],
        isError: true,
      };
    }
    const projects = result.projects || [];
    return {
      content: [
        {
          type: "text",
          text: projects.length > 0
            ? `Projects:\n${projects.map((p) => `- ${p.name} (ID: ${p.id})`).join("\n")}`
            : "No projects found.",
        },
      ],
    };
  }
);

// Tool: Create a new task
server.tool(
  "create-task",
  "Create a new task or subtask",
  {
    title: z.string().min(1).describe("Title of the task"),
    description: z.string().optional().describe("Detailed description of the task"),
    parentId: z.string().optional().describe("ID of the parent task if this is a subtask"),
    projectId: z.string().describe("ID of the project this task belongs to"),
    priority: z.enum(["low", "medium", "high"]).optional().describe("Priority level of the task"),
  },
  async ({ title, description, parentId, projectId, priority }) => {
    const projectResult = await getProject({ id: projectId });
    if (!projectResult.success) {
      return {
        content: [{ type: "text", text: projectResult.error || `Project with ID ${projectId} not found.` }],
        isError: true,
      };
    }

    const result = await createTask({ title, description, parentId, projectId, priority });
    if (!result.success) {
      return {
        content: [{ type: "text", text: result.error || "Failed to create task" }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Created task: ${result.task?.title} (ID: ${result.task?.id}) in project: ${projectResult.project?.name}`,
        },
      ],
    };
  }
);

// Tool: List all tasks
server.tool(
  "list-tasks",
  "List all tasks or subtasks",
  {
    parentId: z.string().optional().describe("ID of the parent task to list subtasks for"),
    projectId: z.string().describe("ID of the project to list tasks for"),
  },
  async ({ parentId, projectId }) => {
    const projectResult = await getProject({ id: projectId });
    if (!projectResult.success) {
      return {
        content: [{ type: "text", text: projectResult.error || `Project with ID ${projectId} not found.` }],
        isError: true,
      };
    }

    let result;
    if (parentId) {
      result = await listChildTasks({ parentId });
      if (result.success && result.tasks) {
        result.tasks = result.tasks.filter((task) => task.projectId === projectId);
      }
    } else {
      result = await listProjectRootTasks({ projectId });
    }

    if (!result.success) {
      return {
        content: [{ type: "text", text: result.error || "Failed to list tasks" }],
        isError: true,
      };
    }

    const formatTask = (task: any) => {
      const status = task.completed ? "[x]" : "[ ]";
      const priorityMarker = task.priority === "high" ? "(!)" : task.priority === "medium" ? "(!)" : "";
      return `${status} ${task.title} ${priorityMarker} (ID: ${task.id})`;
    };

    const tasks = result.tasks || [];
    return {
      content: [
        {
          type: "text",
          text: tasks.length > 0
            ? `Tasks in project "${projectResult.project?.name}":\n${tasks.map(formatTask).join("\n")}`
            : `No tasks found in project "${projectResult.project?.name}".`,
        },
      ],
    };
  }
);

// Tool: Complete a task
server.tool(
  "complete-task",
  "Mark a task as completed",
  {
    id: z.string().describe("ID of the task to complete"),
  },
  async ({ id }) => {
    const result = await completeTask({ id });
    if (!result.success) {
      return {
        content: [{ type: "text", text: result.error || `Task with ID ${id} not found.` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: `Task "${result.task?.title}" marked as completed.` }],
    };
  }
);

// Tool: Create a requirement
server.tool(
  "create-requirement",
  "Create a new requirement",
  {
    projectId: z.string().describe("ID of the project this requirement belongs to"),
    title: z.string().min(1).describe("Title of the requirement"),
    description: z.string().describe("Detailed description of the requirement"),
    type: z.enum(["functional", "technical", "non-functional", "user_story"]).describe("Type of requirement"),
    priority: z.enum(["low", "medium", "high"]).describe("Priority level of the requirement"),
    status: z.enum(["draft", "approved", "implemented"]).describe("Status of the requirement"),
  },
  async ({ projectId, title, description, type, priority, status }) => {
    const projectResult = await getProject({ id: projectId });
    if (!projectResult.success) {
      return {
        content: [{ type: "text", text: projectResult.error || `Project with ID ${projectId} not found.` }],
        isError: true,
      };
    }

    const result = await createRequirement({ projectId, title, description, type, priority, status });
    if (!result.success) {
      return {
        content: [{ type: "text", text: result.error || "Failed to create requirement" }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Created requirement: ${result.requirement?.title} (ID: ${result.requirement?.id}) in project: ${projectResult.project?.name}`,
        },
      ],
    };
  }
);

// Tool: List requirements
server.tool(
  "list-requirements",
  "List all requirements for a project",
  {
    projectId: z.string().describe("ID of the project to list requirements for"),
  },
  async ({ projectId }) => {
    const projectResult = await getProject({ id: projectId });
    if (!projectResult.success) {
      return {
        content: [{ type: "text", text: projectResult.error || `Project with ID ${projectId} not found.` }],
        isError: true,
      };
    }

    const result = await listProjectRequirements({ projectId });
    if (!result.success) {
      return {
        content: [{ type: "text", text: result.error || "Failed to list requirements" }],
        isError: true,
      };
    }

    const formatRequirement = (req: any) => {
      const priorityMarker = req.priority === "high" ? "(!)" : req.priority === "medium" ? "(!)" : "(-)";
      return `${priorityMarker} ${req.title} [${req.type}] (ID: ${req.id})`;
    };

    const requirements = result.requirements || [];
    return {
      content: [
        {
          type: "text",
          text: requirements.length > 0
            ? `Requirements in project "${projectResult.project?.name}":\n${requirements.map(formatRequirement).join("\n")}`
            : `No requirements found in project "${projectResult.project?.name}".`,
        },
      ],
    };
  }
);

// Initialize storage and start the server
async function startServer() {
  try {
    const port = parseInt(process.env.PORT || "54398", 10);
    const app = express();

    // Enable CORS and body parsing
    app.use(cors());
    app.use(bodyParser.json());

    // Add a health check endpoint
    app.get("/health", (req: express.Request, res: express.Response) => {
      res.json({
        status: 'ok',
        uptime: process.uptime()
      });
    });

    // Track active transports
    const transports = new Map<string, SSEServerTransport>();
    let lastTransport: SSEServerTransport | undefined;

    // Create a new server instance for each connection
    app.get("/sse", async (req: express.Request, res: express.Response) => {
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      console.log(`New SSE connection from ${clientIp}`);

      // Create a new transport for this connection
      const transport = new SSEServerTransport('/sse', res as unknown as ServerResponse);
      const transportId = Math.random().toString(36).substring(2);

      try {
        // Connect the transport to the server
        await server.connect(transport);
        console.log('SSE transport connected');

        // Store the transport
        transports.set(transportId, transport);
        lastTransport = transport;

        // Send connected event with transport ID
        res.write(`event: connected\ndata: {"status":"connected","transportId":"${transportId}"}\n\n`);

        // Set up ping interval
        const pingInterval = setInterval(() => {
          if (!res.writableEnded) {
            res.write('event: ping\ndata: {"time":' + Date.now() + '}\n\n');
          } else {
            clearInterval(pingInterval);
          }
        }, 30000);

        // Handle connection close
        req.on('close', () => {
          console.log('SSE connection closed');
          clearInterval(pingInterval);
          transports.delete(transportId);
          if (lastTransport === transport) {
            lastTransport = undefined;
          }
          server.close().catch(console.error);
        });

      } catch (error) {
        console.error('Failed to establish SSE connection:', error);
        transports.delete(transportId);
        res.end();
      }
    });

    // Handle POST requests
    app.post("/sse", async (req: express.Request, res: express.Response) => {
      try {
        console.log('Received message:', req.body);

        // Get the transport ID from headers or use the last transport
        const transportId = req.headers['x-transport-id'] as string;
        const transport = transportId ? transports.get(transportId) : lastTransport;
        
        if (!transport) {
          console.error('No active SSE connection');
          res.status(503).json({ 
            error: 'No active SSE connection. Please establish an SSE connection first.',
            hint: 'Connect to GET /sse before sending messages'
          });
          return;
        }

        // Handle the message
        await transport.handlePostMessage(req as IncomingMessage, res as unknown as ServerResponse, req.body);

      } catch (error) {
        console.error('Error handling message:', error);
        res.status(500).json({ 
          error: 'Internal server error',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Start the server
    app.listen(port, "0.0.0.0", () => {
      console.log(`Task and Requirement Planner MCP Server running on port ${port}`);
      console.log(`SSE endpoint available at http://localhost:${port}/sse`);
    });

  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();