import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { prisma } from "./src/lib/prisma";

// Initialize the MCP server instance. This should be a singleton.
export const server = new Server(
    { name: "hrm-mcp-server", version: "1.0.0" },
    { capabilities: { tools: {} } }
);

console.log('[MCP] Server initialized. Ready for tool registrations.');

/**
 * Handler for listing all available tools to the AI client.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: "get_dashboard_stats",
            description: "Fetches high-level dashboard metrics for the current day: total employees, today's total present, and total absent.",
            inputSchema: { type: "object", properties: {} }
        },
        {
            name: "get_employee_attendance",
            description: "Fetches attendance for a specific employee for the current month.",
            inputSchema: {
                type: "object",
                properties: {
                    employeeIdentifier: {
                        type: "string",
                        description: "The database UUID, employee ID (e.g., \"EMP-1001\"), or email of the employee."
                    }
                },
                required: ["employeeIdentifier"]
            }
        }
    ]
}));

/**
 * Handler for executing a tool call from the AI client.
 */
server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    try {
        // --- Tool: get_dashboard_stats ---
        if (request.params.name === "get_dashboard_stats") {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date();
            end.setHours(23, 59, 59, 999);

            const [totalEmployees, todaysLogs, leavesToday] = await Promise.all([
                prisma.user.count({ where: { isActive: true } }),
                prisma.attendanceLog.findMany({
                    where: { timestamp: { gte: start, lte: end }, user: { isActive: true } },
                    select: { employeeId: true },
                    distinct: ['employeeId'],
                }),
                prisma.leave.count({
                    where: { status: 'Approved', startDate: { lte: end }, endDate: { gte: start } },
                }),
            ]);

            const presentToday = todaysLogs.length;
            const absentToday = totalEmployees - presentToday - leavesToday;

            const stats = {
                totalActiveEmployees: totalEmployees,
                totalPresentToday: presentToday,
                totalAbsentToday: Math.max(0, absentToday),
                totalOnLeaveToday: leavesToday,
            };

            return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
        }

        // --- Tool: get_employee_attendance ---
        if (request.params.name === "get_employee_attendance") {
            const { employeeIdentifier } = request.params.arguments as { employeeIdentifier: string };

            const user = await prisma.user.findFirst({
                where: {
                    OR: [{ id: employeeIdentifier }, { employeeId: employeeIdentifier }, { email: employeeIdentifier }],
                },
            });

            if (!user) {
                throw new Error(`Employee with identifier "${employeeIdentifier}" not found.`);
            }

            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

            const attendanceLogs = await prisma.attendanceLog.findMany({
                where: {
                    employeeId: user.id,
                    timestamp: { gte: startOfMonth, lte: endOfMonth },
                },
                orderBy: { timestamp: 'asc' },
            });

            const result = {
                employee: { name: user.name, id: user.id },
                totalLogs: attendanceLogs.length
            };

            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        throw new Error(`Tool "${request.params.name}" not found.`);
    } catch (error: any) {
        console.error(`[MCP-Tool Error]:`, error);
        return {
            content: [{
                type: "text", // Using text type for error fallback to avoid strict schema issues
                text: `Failed to execute tool: ${error?.message}`
            }]
        };
    }
});