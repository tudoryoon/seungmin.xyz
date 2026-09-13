export function remainingStations(stations, choices) {
  const used = new Set(choices.map(choice => choice.station_id));
  return stations.filter(station => !used.has(station.id));
}

export function createRouletteStore(client, identity) {
  function check(owner) {
    const current = identity();
    if (!owner.id || current.id !== owner.id || current.epoch !== owner.epoch) throw new Error('ACCOUNT_CHANGED');
  }
  return {
    async list() {
      const owner = {...identity()}, rows = []; check(owner);
      for (let from = 0; ; from += 500) {
        const {data,error} = await client.from('roulette_choices').select('station_id,station_name,lines,day,selected_at')
          .eq('user_id',owner.id).order('selected_at',{ascending:false}).order('station_id').range(from,from+499);
        check(owner); if (error) throw error;
        if (!Array.isArray(data)) throw new Error('INVALID_HISTORY');
        rows.push(...data);
        if (data.length < 500) return rows;
      }
    },
    async choose(station) {
      const owner = {...identity()}; check(owner);
      const {data,error} = await client.rpc('roulette_choose', {
        p_station_id:station.id,p_station_name:station.name,p_lines:station.lines
      });
      check(owner); if (error) throw error;
      if (!data || data.station_id !== station.id || !/^\d{4}-\d{2}-\d{2}$/.test(data.day)) throw new Error('INVALID_HISTORY');
      return data;
    }
  };
}
