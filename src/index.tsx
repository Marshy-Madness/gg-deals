import { definePlugin, routerHook } from "@decky/api";
import {
  ButtonItem,
  DropdownItem,
  Navigation,
  PanelSection,
  PanelSectionRow,
  TextField,
  ToggleField,
} from "@decky/ui";
import { useEffect, useState } from "react";
import { FaTags } from "react-icons/fa";
import { getSettings, notifySettingsChanged, setSettings, Settings } from "./api";
import { StoreBadge } from "./StoreBadge";

const REGIONS: [string, string][] = [
  ["us", "United States"],
  ["ca", "Canada"],
  ["gb", "United Kingdom"],
  ["eu", "Europe"],
  ["au", "Australia"],
  ["br", "Brazil"],
  ["de", "Germany"],
  ["fr", "France"],
  ["it", "Italy"],
  ["es", "Spain"],
  ["nl", "Netherlands"],
  ["be", "Belgium"],
  ["ie", "Ireland"],
  ["ch", "Switzerland"],
  ["pl", "Poland"],
  ["se", "Sweden"],
  ["no", "Norway"],
  ["dk", "Denmark"],
  ["fi", "Finland"],
];

function Content() {
  const [settings, setLocal] = useState<Settings | null>(null);

  useEffect(() => {
    getSettings().then(setLocal);
  }, []);

  if (!settings) return null;

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setLocal(next);
    setSettings(next.api_key, next.region, next.include_keyshops).then(notifySettingsChanged);
  };

  return (
    <PanelSection title="Settings">
      <PanelSectionRow>
        <TextField
          label="gg.deals API key"
          bIsPassword
          value={settings.api_key}
          onChange={(e) => update({ api_key: e.target.value })}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <DropdownItem
          label="Region"
          rgOptions={REGIONS.map(([data, label]) => ({ data, label }))}
          selectedOption={settings.region}
          onChange={(option) => update({ region: option.data })}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ToggleField
          label="Include keyshops"
          description="Count third-party key resellers when finding the lowest price"
          checked={settings.include_keyshops}
          onChange={(include_keyshops) => update({ include_keyshops })}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => Navigation.NavigateToExternalWeb("https://gg.deals/api/")}
        >
          Get an API key
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  );
}

export default definePlugin(() => {
  routerHook.addGlobalComponent("GGDealsStoreBadge", StoreBadge);

  return {
    name: "gg.deals",
    titleView: <div>gg.deals</div>,
    content: <Content />,
    icon: <FaTags />,
    onDismount() {
      routerHook.removeGlobalComponent("GGDealsStoreBadge");
    },
  };
});
