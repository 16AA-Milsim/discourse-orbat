# name: discourse-orbat
# version: 0.9.1
# about: 16AA ORBAT plugin for Discourse
# author: OpenAI & Darojax

# frozen_string_literal: true

# define namespace before requiring service
module ::Orbat
  PLUGIN_NAME = "discourse-orbat"
end
require_relative "lib/orbat/service"

register_asset "stylesheets/common/orbat.scss"
add_admin_route "orbat_admin.nav_title", "orbat"

after_initialize do
  on(:group_user_created)  { ::Orbat::Service.clear_cache }
  on(:group_user_destroyed){ ::Orbat::Service.clear_cache }

  on(:site_setting_changed) do |name, _old_value, _new_value|
    if %i[orbat_json orbat_cache_ttl orbat_hide_hidden_groups].include?(name.to_sym)
      ::Orbat::Service.clear_cache
    end
  end

  module ::Orbat
    class PublicController < ::ApplicationController
      requires_login false

      def index
        render html: "", layout: "application"
      end

      def data
        render_json_dump(::Orbat::Service.cached_tree)
      end
    end

    class AdminController < ::Admin::AdminController
      requires_plugin ::Orbat::PLUGIN_NAME

      def show
        render_json_dump(
          configuration: SiteSetting.orbat_json,
          tree: ::Orbat::Service.cached_tree,
        )
      end

      def preview
        configuration = params.require(:configuration)
        render_json_dump(::Orbat::Service.preview(configuration))
      rescue ActionController::ParameterMissing => e
        render_json_error(e.message)
      rescue => e
        Rails.logger.error(
          "[orbat] preview failed: #{e.class}: #{e.message}\n#{e.backtrace&.join("\n")}",
        )
        render_json_error(e.message)
      end

      def restore
        default_configuration = SiteSetting.defaults[:orbat_json].presence ||
          ::Orbat::Service::SETTING_DEFAULTS[:orbat_json]

        if default_configuration.blank?
          render_json_error(I18n.t("orbat_admin.errors.missing_default"), status: 422)
          return
        end

        SiteSetting.orbat_json = default_configuration
        ::Orbat::Service.clear_cache

        render_json_dump(
          configuration: default_configuration,
          tree: ::Orbat::Service.cached_tree,
        )
      rescue => e
        Rails.logger.error(
          "[orbat] restore default failed: #{e.class}: #{e.message}\n#{e.backtrace&.join("\n")}",
        )
        render_json_error(e.message)
      end
    end
  end


  Discourse::Application.routes.append do
    get "/orbat" => "orbat/public#index", constraints: { format: :html }
    get "/orbat.json" => "orbat/public#data"
    get "/admin/plugins/orbat" => "admin/plugins#index"
    get "/admin/plugins/orbat.json" => "orbat/admin#show"
    post "/admin/plugins/orbat/preview" => "orbat/admin#preview"
    post "/admin/plugins/orbat/restore" => "orbat/admin#restore"
  end
end
