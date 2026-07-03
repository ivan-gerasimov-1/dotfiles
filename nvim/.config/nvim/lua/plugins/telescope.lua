return {
  "nvim-telescope/telescope.nvim",
  dependencies = {
    "nvim-lua/plenary.nvim",
  },
  config = function()
    require("telescope").setup({
      defaults = {
        disable_devicons = true,
      },
    })

    local telescope = require("telescope.builtin")

    vim.keymap.set("n", "<leader>ff", telescope.find_files, { desc = "Find files" })
    vim.keymap.set("n", "<leader>fg", telescope.live_grep, { desc = "Search text" })
    vim.keymap.set("n", "<leader>fb", telescope.buffers, { desc = "Find buffer" })
    vim.keymap.set("n", "<leader>fh", telescope.help_tags, { desc = "Search help" })
  end,
}
