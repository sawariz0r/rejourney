CREATE OR REPLACE FUNCTION rj_flatten_dashboard_path(path_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    from_paths text[] := ARRAY[
        '/analytics/api',
        '/analytics/devices',
        '/analytics/geo',
        '/analytics/journeys',
        '/analytics/heatmaps'
    ];
    to_paths text[] := ARRAY[
        '/api',
        '/devices',
        '/geo',
        '/journeys',
        '/heatmaps'
    ];
    app_prefix text;
    from_path text;
    to_path text;
    idx integer;
BEGIN
    IF path_value IS NULL THEN
        RETURN path_value;
    END IF;

    FOR idx IN 1..array_length(from_paths, 1) LOOP
        FOREACH app_prefix IN ARRAY ARRAY['', '/dashboard', '/demo'] LOOP
            from_path := app_prefix || from_paths[idx];
            to_path := app_prefix || to_paths[idx];

            IF path_value = from_path
                OR path_value LIKE from_path || '/%'
                OR path_value LIKE from_path || '?%'
                OR path_value LIKE from_path || '#%'
            THEN
                RETURN to_path || substring(path_value from length(from_path) + 1);
            END IF;
        END LOOP;
    END LOOP;

    RETURN path_value;
END;
$$;

CREATE OR REPLACE FUNCTION rj_flatten_workspace_tabs(tabs_value json)
RETURNS json
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    tab_value jsonb;
    normalized jsonb := '[]'::jsonb;
BEGIN
    IF tabs_value IS NULL OR jsonb_typeof(tabs_value::jsonb) <> 'array' THEN
        RETURN '[]'::json;
    END IF;

    FOR tab_value IN SELECT value FROM jsonb_array_elements(tabs_value::jsonb) AS elem(value) LOOP
        IF jsonb_typeof(tab_value) = 'object' THEN
            IF tab_value ? 'path' AND jsonb_typeof(tab_value->'path') = 'string' THEN
                tab_value := jsonb_set(
                    tab_value,
                    '{path}',
                    to_jsonb(rj_flatten_dashboard_path(tab_value->>'path')),
                    false
                );
            END IF;

            IF tab_value ? 'route' AND jsonb_typeof(tab_value->'route') = 'string' THEN
                tab_value := jsonb_set(
                    tab_value,
                    '{route}',
                    to_jsonb(rj_flatten_dashboard_path(tab_value->>'route')),
                    false
                );
            END IF;
        END IF;

        normalized := normalized || jsonb_build_array(tab_value);
    END LOOP;

    RETURN normalized::json;
END;
$$;

UPDATE ui_workspaces
SET
    tabs = rj_flatten_workspace_tabs(tabs),
    recently_closed = rj_flatten_workspace_tabs(recently_closed),
    updated_at = NOW()
WHERE tabs::text LIKE '%/analytics/%'
   OR recently_closed::text LIKE '%/analytics/%';

DROP FUNCTION rj_flatten_workspace_tabs(json);
DROP FUNCTION rj_flatten_dashboard_path(text);
