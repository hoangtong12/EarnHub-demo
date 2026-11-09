import Task from "../models/Task.js";

export async function listTasks(req, res) {
  const rows = await Task.find({ active: true }).sort({ createdAt: -1 });
  res.json(rows);
}
