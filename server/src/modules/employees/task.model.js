const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required.'],
      trim: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Assigned employee is required.'],
    },
    date: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['pending', 'completed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

TaskSchema.index({ assignedTo: 1, date: 1, status: 1 });

module.exports = mongoose.model('Task', TaskSchema);
