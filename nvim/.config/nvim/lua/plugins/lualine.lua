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
          b = { fg = "#dedede", bg = "#3a3637" },
          c = { fg = "#989898", bg = "#302c2c" },
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
      component_separators = { left = "·", right = "·" },
      section_separators = "",
      globalstatus = true,
    },
    sections = {
      lualine_a = { "mode" },
      lualine_b = { "branch" },
      lualine_c = {
        {
          "filename",
          path = 1,
          file_status = true,
          symbols = {
            modified = " M",
            readonly = " R",
            unnamed = " U",
            newfile = " N",
          },
        },
      },
      lualine_x = { "diagnostics", "encoding", "filetype" },
      lualine_y = { "progress" },
      lualine_z = { "location" },
    },
  },
}
