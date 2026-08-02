return {
  "folke/todo-comments.nvim",
  cmd = "TodoTelescope",
  dependencies = {
    "nvim-lua/plenary.nvim",
  },
  keys = {
    {
      "<leader>ft",
      "<cmd>TodoTelescope<CR>",
      desc = "Find TODOs",
    },
  },
  opts = {},
}
