const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema(
  {
    taskDescription: {
      type: String,
      required: [true, 'Task description is required.'],
      trim: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Assigned employee is required.'],
    },
    assignedDate: {
      type: Date,
      default: Date.now,
    },
    scheduledFor: {
      type: Date,
      required: [true, 'Task scheduled date is required.']
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Completed'],
      default: 'Pending',
    },
  },
  { timestamps: true }
);

TaskSchema.index({ employeeId: 1, scheduledFor: 1, status: 1 });

module.exports = mongoose.model('Task', TaskSchema);
