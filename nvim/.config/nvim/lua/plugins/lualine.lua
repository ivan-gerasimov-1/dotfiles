return {
  "nvim-lualine/lualine.nvim",
  dependencies = {
    "nvim-tree/nvim-web-devicons",
  },
  opts = {
    options = {
      theme = {
        normal = {
          a = { fg = "#302c2c", bg = "#dedede", gui = "bold" },
          b = { fg = "#989898", bg = "#302c2c" },
          c = { fg = "#cacaca", bg = "#302c2c" },
        },
        insert = { a = { fg = "#302c2c", bg = "#d7a65f", gui = "bold" } },
        visual = { a = { fg = "#302c2c", bg = "#b99ab7", gui = "bold" } },
        replace = { a = { fg = "#ffffff", bg = "#da5b2c", gui = "bold" } },
        command = { a = { fg = "#302c2c", bg = "#cacaca", gui = "bold" } },
        inactive = {
          a = { fg = "#7f7f7f", bg = "#302c2c" },
          b = { fg = "#7f7f7f", bg = "#302c2c" },
          c = { fg = "#656565", bg = "#302c2c" },
        },
      },
      icons_enabled = false,
      component_separators = "",
      section_separators = "",
      globalstatus = true,
    },
    sections = {
      lualine_a = {
        {
          "mode",
          fmt = function(mode)
            return mode:sub(1, 1)
          end,
        },
      },
      lualine_b = { "branch" },
      lualine_c = {
        {
          "filename",
          path = 1,
          shorting_target = 40,
          file_status = true,
          symbols = {
            modified = " M",
            readonly = " R",
            unnamed = " U",
            newfile = " N",
          },
        },
      },
      lualine_x = {
        "diagnostics",
        {
          "encoding",
          cond = function()
            local encoding = vim.bo.fileencoding
            return encoding ~= "" and encoding:lower() ~= "utf-8"
          end,
        },
        "filetype",
      },
      lualine_y = {},
      lualine_z = {},
    },
  },
}
